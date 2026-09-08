module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo pulls in the Reanimated/worklets plugin automatically
    // when the package is installed. Don't add it by hand - listing it twice
    // breaks worklets with a confusing "not a worklet" error at runtime.
    presets: ['babel-preset-expo'],
  };
};
