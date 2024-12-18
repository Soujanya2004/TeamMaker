const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: String,
  age: Number,
  year: String,
  course: String,
  linkedin: String,
  github: String,
  experience: String,
  profilePic: String,
});

module.exports = mongoose.model('User', UserSchema);
