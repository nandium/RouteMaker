module.exports = {
  publicPath:
    process.env.NODE_ENV === 'production' && process.env.VUE_APP_PRODUCTION_ROUTE
      ? process.env.VUE_APP_PRODUCTION_ROUTE
      : '/',
  chainWebpack: (config) => {
    config.plugin('html').tap((args) => {
      args[0].title = 'Route Maker';
      args[0].TRACKING_ID =
        process.env.NODE_ENV === 'production' && process.env.VUE_APP_TRACKING_ID
          ? process.env.VUE_APP_TRACKING_ID
          : '';
      return args;
    });
  },
};
