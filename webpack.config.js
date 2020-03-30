const path = require("path");

module.exports = {
  mode: "development",
  entry: "./script1.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist")
  },
  node: {
    fs: 'empty'
  },
  module: {
    rules: [
      {
        test: /\.(glsl|frag|vert)$/,
        exclude: /(node_modules)/,
        use: {
          loader: "raw-loader"
        }
      }
    ]
  }
};
