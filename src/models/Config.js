const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create a static method to get a config value
configSchema.statics.getValue = async function(key) {
  const config = await this.findOne({ key });
  return config ? config.value : null;
};

// Create a static method to set a config value
configSchema.statics.setValue = async function(key, value) {
  const config = await this.findOneAndUpdate(
    { key },
    { value, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return config;
};

module.exports = mongoose.model('Config', configSchema);