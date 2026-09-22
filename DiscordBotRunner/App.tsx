/**
 * Discord Bot Runner
 *
 * Runs two kinds of bots locally on the phone:
 *   - Node.js bots  -> nodejs-mobile-react-native (nodejs-assets/nodejs-project)
 *   - Python bots   -> Chaquopy native module (android/app/src/main/python)
 *
 * @format
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  NativeEventEmitter,
  NativeModules,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import nodejs from 'nodejs-mobile-react-native';

type Bot = {name: string; running: boolean};
type LogLine = {id: number; source: string; line: string};
type Tab = 'js' | 'python';

const {PythonRunner} = NativeModules;

let logId = 0;

function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('js');
  const [token, setToken] = useState('');
  const [jsBots, setJsBots] = useState<Bot[]>([]);
  const [pyBots, setPyBots] = useState<Bot[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const logRef = useRef<FlatList<LogLine>>(null);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const appendLog = useCallback((source: string, line: string) => {
    setLogs(prev => {
      const next = [...prev, {id: logId++, source, line}];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
  }, []);

  const refreshJs = useCallback(() => {
    nodejs.channel.send({cmd: 'list'});
  }, []);

  const refreshPython = useCallback(() => {
    if (!PythonRunner) {
      appendLog('PY', 'PythonRunner native module is unavailable.');
      return;
    }
    PythonRunner.listBots()
      .then((json: string) => setPyBots(JSON.parse(json)))
      .catch((e: Error) => appendLog('PY', 'listBots failed: ' + e.message));
  }, [appendLog]);

  const refreshCurrent = useCallback(() => {
    if (tab === 'js') {
      refreshJs();
    } else {
      refreshPython();
    }
  }, [tab, refreshJs, refreshPython]);

  useEffect(() => {
    appendLog('APP', 'Starting Node.js runtime...');
    nodejs.start('main.js');

    const onMessage = (msg: {type: string; payload: any}) => {
      if (!msg || !msg.type) {
        return;
      }
      switch (msg.type) {
        case 'js-ready':
          appendLog('JS', 'Node.js runtime ready (pid ' + msg.payload.pid + ').');
          break;
        case 'js-list':
          setJsBots(msg.payload || []);
          break;
        case 'js-log':
          appendLog('JS/' + (msg.payload.name || 'node'), msg.payload.line);
          break;
        case 'js-response':
          if (!msg.payload.result.ok) {
            appendLog('JS', 'Error: ' + msg.payload.result.error);
          }
          break;
      }
    };
    nodejs.channel.addListener('message', onMessage);

    let pySubscription: {remove: () => void} | undefined;
    if (PythonRunner) {
      const emitter = new NativeEventEmitter(PythonRunner);
      pySubscription = emitter.addListener('python-log', (payload: {line: string}) =>
        appendLog('PY', payload.line),
      );
    }

    refreshJs();
    refreshPython();

    return () => {
      nodejs.channel.removeListener('message', onMessage);
      pySubscription?.remove();
    };
  }, [appendLog, refreshJs, refreshPython]);

  const startJsBot = useCallback(
    (name: string) => {
      appendLog('JS', 'Starting ' + name + '...');
      nodejs.channel.send({id: logId++, cmd: 'start', name, token: tokenRef.current});
    },
    [appendLog],
  );

  const startPythonBot = useCallback(
    async (name: string) => {
      appendLog('PY', 'Starting ' + name + '...');
      try {
        const result = await PythonRunner.startBot(name, tokenRef.current);
        if (result !== 'started') {
          appendLog('PY', 'Could not start ' + name + ': ' + result);
        }
      } catch (e: any) {
        appendLog('PY', 'Could not start ' + name + ': ' + e.message);
      }
      refreshPython();
    },
    [appendLog, refreshPython],
  );

  const stopBot = useCallback(
    async (bot: Bot) => {
      if (tab === 'js') {
        nodejs.channel.send({id: logId++, cmd: 'stop', name: bot.name});
      } else {
        await PythonRunner.stopBot(bot.name);
        refreshPython();
      }
    },
    [tab, refreshPython],
  );

  const bots = tab === 'js' ? jsBots : pyBots;
  const startBot = tab === 'js' ? startJsBot : startPythonBot;

  const startAll = useCallback(async () => {
    setRunning(true);
    for (const bot of bots) {
      if (!bot.running) {
        await startBot(bot.name);
      }
    }
    setRunning(false);
  }, [bots, startBot]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1f22" />
      <View style={styles.header}>
        <Text style={styles.title}>Discord Bot Runner</Text>
        <Text style={styles.subtitle}>Node.js + Python, running on this device</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'js' && styles.tabActive]}
          onPress={() => setTab('js')}>
          <Text style={[styles.tabText, tab === 'js' && styles.tabTextActive]}>
            Node.js bots
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'python' && styles.tabActive]}
          onPress={() => setTab('python')}>
          <Text style={[styles.tabText, tab === 'python' && styles.tabTextActive]}>
            Python bots
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.tokenInput}
        placeholder="Discord bot token"
        placeholderTextColor="#8a8d93"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={refreshCurrent}>
          <Text style={styles.actionText}>Refresh</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.primaryButton]}
          onPress={startAll}
          disabled={running}>
          <Text style={styles.actionText}>{running ? 'Starting...' : 'Start all'}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => setLogs([])}>
          <Text style={styles.actionText}>Clear log</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.botList}
        data={bots}
        keyExtractor={item => item.name}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No {tab === 'js' ? 'Node.js' : 'Python'} bots found. Add a script and rebuild.
          </Text>
        }
        renderItem={({item}) => (
          <View style={styles.botRow}>
            <View style={styles.botInfo}>
              <Text style={styles.botName}>{item.name}</Text>
              <Text style={[styles.botStatus, item.running && styles.botStatusOn]}>
                {item.running ? 'running' : 'stopped'}
              </Text>
            </View>
            <Pressable
              style={[styles.botButton, item.running && styles.stopButton]}
              onPress={() => (item.running ? stopBot(item) : startBot(item.name))}>
              <Text style={styles.botButtonText}>{item.running ? 'Stop' : 'Start'}</Text>
            </Pressable>
          </View>
        )}
      />

      <Text style={styles.logTitle}>Log</Text>
      <FlatList
        ref={logRef}
        style={styles.logList}
        data={logs}
        keyExtractor={item => String(item.id)}
        onContentSizeChange={() => logRef.current?.scrollToEnd({animated: false})}
        renderItem={({item}) => (
          <Text style={styles.logLine}>
            <Text style={styles.logSource}>[{item.source}] </Text>
            {item.line}
          </Text>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#1e1f22'},
  header: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8},
  title: {color: '#ffffff', fontSize: 22, fontWeight: '700'},
  subtitle: {color: '#b5bac1', fontSize: 13, marginTop: 2},
  tabs: {flexDirection: 'row', marginHorizontal: 16, marginTop: 8},
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#2b2d31',
    borderRadius: 8,
    marginRight: 8,
  },
  tabActive: {backgroundColor: '#5865f2'},
  tabText: {color: '#b5bac1', fontWeight: '600'},
  tabTextActive: {color: '#ffffff'},
  tokenInput: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#2b2d31',
    borderRadius: 8,
    color: '#ffffff',
  },
  actions: {flexDirection: 'row', marginHorizontal: 16, marginTop: 10},
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#2b2d31',
    borderRadius: 8,
    marginRight: 8,
  },
  primaryButton: {backgroundColor: '#5865f2'},
  actionText: {color: '#ffffff', fontWeight: '600'},
  botList: {marginHorizontal: 16, marginTop: 12, maxHeight: 180},
  empty: {color: '#8a8d93', paddingVertical: 12},
  botRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2b2d31',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  botInfo: {flex: 1, marginRight: 8},
  botName: {color: '#ffffff', fontWeight: '600'},
  botStatus: {color: '#8a8d93', fontSize: 12, marginTop: 2},
  botStatusOn: {color: '#3ba55d'},
  botButton: {
    backgroundColor: '#3ba55d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  stopButton: {backgroundColor: '#ed4245'},
  botButtonText: {color: '#ffffff', fontWeight: '700'},
  logTitle: {
    color: '#b5bac1',
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 8,
  },
  logList: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    backgroundColor: '#111214',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  logLine: {color: '#dbdee1', fontFamily: 'monospace', fontSize: 12, marginBottom: 2},
  logSource: {color: '#5865f2'},
});

export default App;
