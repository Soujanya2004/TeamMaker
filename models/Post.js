const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: String,
    description: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requiredPeople: Number,
    skillsRequired: [String],
    poster: String,  // Optional image poster
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Store requests
    acceptedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Store accepted users
  });
  
  

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
