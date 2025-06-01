const Config = require('../models/Config');

// Initialize default configurations
async function initializeConfigs() {
  const defaultConfigs = [
    {
      key: 'extract_quiz_enabled',
      value: true,
      description: 'Enable or disable the quiz extraction feature'
    }
  ];

  for (const config of defaultConfigs) {
    await Config.setValue(config.key, config.value);
  }
}

// Get a configuration value
async function getConfig(key) {
  return await Config.getValue(key);
}

// Set a configuration value
async function setConfig(key, value) {
  return await Config.setValue(key, value);
}

module.exports = {
  initializeConfigs,
  getConfig,
  setConfig
}; 