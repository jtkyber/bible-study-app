module.exports = {
  plugins: [
    'postcss-flexbugs-fixes',
    [
    'postcss-preset-env', 
    {
        autoprefixer: {
            flexbox: 'no-2009',
        },
        stage: 1,
        features: {
            'custom-properties': false,
        },
    },
    ],
    [
    'cssnano', 
    {
        preset: 'default'
    },
    ],
    'postcss-mixins',
    'postcss-simple-vars',
    'postcss-import'
  ]
}

