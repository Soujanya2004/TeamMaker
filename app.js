const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const bcrypt = require('bcrypt');
const methodOverride = require('method-override');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');
require('dotenv').config();

// Models
const User = require('./models/User');
const Post = require('./models/Post');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(flash());  // Flash middleware
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Passport configuration
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });
      if (!user) return done(null, false, { message: 'User not found' });
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return done(null, false, { message: 'Incorrect password' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Database connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Flash messages middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Routes

// Home page route (display all posts)
app.get('/', async (req, res) => {
  try {
    const posts = await Post.find({}).populate('createdBy');
    const user = req.isAuthenticated() ? req.user : null;
    res.render('index', { posts, user });
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

// Signup POST route
app.post('/signup', async (req, res) => {
  const { username, password, name, age, year, course, linkedin, github, experience } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, name, age, year, course, linkedin, github, experience });
    await newUser.save();
    req.flash('success_msg', 'Registration successful! Please log in.');
    res.redirect('/login');
  } catch (err) {
    req.flash('error_msg', 'Error during registration.');
    res.redirect('/signup');
  }
});

// Login POST route
app.post('/login', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));

// Profile route
app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.render('profile', { user: req.user });
});

// Update profile route
app.post('/update-profile', async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  
  const { name, age, course, linkedin, github, experience } = req.body;

  try {
    req.user.name = name;
    req.user.age = age;
    req.user.course = course;
    req.user.linkedin = linkedin;
    req.user.github = github;
    req.user.experience = experience;

    await req.user.save();
    req.flash('success_msg', 'Profile updated successfully!');
    res.redirect('/profile');
  } catch (err) {
    req.flash('error_msg', 'Error updating profile.');
    res.redirect('/profile');
  }
});

// Render login form
app.get('/login', (req, res) => {
  res.render('login');
});

// Render signup form
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Logout route
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash('success_msg', 'You have logged out successfully!');
    res.redirect('/');
  });
});

// Middleware to check if the user is logged in
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('error_msg', 'You need to log in first!');
    res.redirect('/login');
  }
}

// Protect the /addpost route
app.get('/addpost', isAuthenticated, (req, res) => {
  res.render('addpost', { user: req.user });
});

// Add Post route (POST)
app.post('/addpost', isAuthenticated, async (req, res) => {
  const { title, description, poster, requiredPeople, skillsRequired } = req.body;

  try {
    const newPost = new Post({
      title,
      description,
      poster,
      requiredPeople, // Store required number of people
      skillsRequired: skillsRequired.split(',').map(skill => skill.trim()), // Store skills as an array
      createdBy: req.user._id
    });

    await newPost.save();
    req.flash('success_msg', 'Post added successfully!');
    res.redirect('/');
  } catch (err) {
    req.flash('error_msg', 'Error adding post. Please try again.');
    res.redirect('/addpost');
  }
});

// View Post Details Route
app.get('/post/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('createdBy');
    
    if (!post) {
      return res.redirect('/');
    }

    const user = req.isAuthenticated() ? req.user : null;
    res.render('post-detail', { post, user });

  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

// Request to join post and redirect to /yourteam route
app.post('/request/:postId', isAuthenticated, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user._id;

  try {
    const post = await Post.findById(postId);

    if (post.requests.includes(userId)) {
      req.flash('error_msg', 'You have already requested to join this post.');
      return res.redirect(`/post/${postId}`);
    }

    post.requests.push(userId);
    await post.save();
    req.flash('success_msg', 'You have successfully requested to join this post.');
    res.redirect('/yourteam');

  } catch (err) {
    req.flash('error_msg', 'Error while processing the request. Please try again.');
    res.redirect(`/post/${postId}`);
  }
});

// Your team route to display requested posts
app.get('/yourteams', isAuthenticated, async (req, res) => {
  try {
    const posts = await Post.find({ requests: req.user._id }).populate('createdBy');
    res.render('your-team', { posts, user: req.user });
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

// Route to delete a post (DELETE)
app.delete('/deletepost/:id', isAuthenticated, async (req, res) => {
  const postId = req.params.id;

  try {
    const post = await Post.findById(postId);

    // Ensure the user is the post's creator
    if (post.createdBy.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'You are not authorized to delete this post.');
      return res.redirect('/');
    }

    // Delete the post
    await post.deleteOne();
    req.flash('success_msg', 'Post deleted successfully!');
    res.redirect('/');
  } catch (err) {
    console.log(err);
    req.flash('error_msg', 'Error deleting post. Please try again.');
    res.redirect('/');
  }
});

// Server setup
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
