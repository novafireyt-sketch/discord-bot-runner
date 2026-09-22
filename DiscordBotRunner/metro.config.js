const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * The Node.js bot project is bundled by nodejs-mobile, not Metro, so we must
 * exclude it from Metro's module graph to avoid haste collisions.
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /nodejs-assets\/.*/,
      /node_modules\/nodejs-mobile-react-native\/nodejs-assets\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
