module.exports = {
  publicPath: process.env.NODE_ENV === 'production' ? '/RouteMaker/' : '/',
  chainWebpack: (config) => {
    config.plugin('html').tap((args) => {
      args[0].title = 'Route Maker';
      return args;
    });
  },
};
