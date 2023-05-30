const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');
const { ObjectId } = require('bson');
const multer = require('multer');
const fs = require('fs');//for storing image in binary form
const moment = require('moment');//for date format
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const { boolean } = require('webidl-conversions');
app.use(cors());
require('dotenv').config();
// Set up session middleware
app.use(
  session({
    secret: process.env.session_key,
    resave: false,
    saveUninitialized: true
  })
);
// Middleware function to authenticate JWT tokens and store in session
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // Store the token in the session
    req.session.token = token;
    // Verify the token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = decoded;
      console.log("req.user=", req.user);
      next();
    });
  } else if (req.session.token) {
    // Token already exists in session, use it for verification
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = decoded;
      console.log("req.user=", req.user);
      next();
    });
  } else {
    console.log("No token found");
    return res.sendStatus(401);
  }
};


app.use(express.json());


// Step 1: Define a Mongoose schema for LoginCredential,events-data
const LoginCredentialSchema = new mongoose.Schema({
  id:ObjectId,
  usertype:String,
  username: String,
  password: String,
  status:String,
  date: { type: Date, default: Date.now }
});
const eventsDataSchema = new mongoose.Schema({
  id:ObjectId,
  EventName:String,
  DateHeld:String,
  EventOrganizers:String,
  Place:String,
  about:String,
   image: { type: Buffer, required: true },
   time:String,
  createBy:String,
  likes:Number,
  TicketPrice:Number
});

const LikesSchema = new mongoose.Schema({
  id:ObjectId,
  username:String,
  EventName:String,
  LikeStatus:Boolean,
  like:Boolean,
});

const ProfileData = new mongoose.Schema({
  id:ObjectId,
  username:String,
  image: { type: Buffer, required: true },
});
// Step 2: Create a Mongoose model for LoginCredential
const LoginCredential = mongoose.model('login-credential', LoginCredentialSchema, 'login-credential');

const EventsData = mongoose.model('events-data', eventsDataSchema, 'events-data');

const EventsLikes = mongoose.model('EventLikes', LikesSchema, 'EventLikes');

const profileData = mongoose.model('profile-data', ProfileData, 'profile-data');


mongoose.connect('mongodb+srv://alijone2444:sweety123456@cluster0.8qq6qs2.mongodb.net/events', { useNewUrlParser: true } ,{useUnifiedTopology: true})
  .then(() => {
    console.log('connected to database');
  })
  .catch((err) => {
    console.log(err);
  });
  
  app.post('/login', async function(req, res) {
    try {
      const { usertype, username, password } = req.body;
      const loginCredential = await LoginCredential.findOne({ usertype, username, status: 'Active' }, { password: 1 });
      if (loginCredential) {    
        // Compare the user's entered password with the saved hashed password
        bcrypt.compare(password, loginCredential.password, function(err, result) {
          if (err) {
            // Handle error
            console.error(err);
            res.status(500).send({ error: 'Internal server error' });
          } else if (result) {
            // Passwords match, so generate a JWT token and send it back to the client
            const payload = { username };
            const secretKey = process.env.JWT_SECRET;
            const options = { expiresIn: '1h' };
            const token = jwt.sign(payload, secretKey, options);
            res.send({ status: true, token });
          } else {
            // Passwords don't match, so send an error response
            res.send({ status: false });
            
          }
        });
      } else {
        // If a matching document is not found, send an error response
        res.send({ status: false });
      }
    } catch (error) {
      // Handle any errors that occur
      console.error(error);
      res.status(500).send({ error: 'Internal server error' });
    }
  });
  

app.post('/Signup', async function(req, res) {
  try {
    // Get the username and password from the request body
    const { userType } = req.body;
    const { username } = req.body;
    const { password } = req.body;
    const {date} = req.body;

    const hash = await bcrypt.hash(password, 10);

    // Use the Mongoose model to find a document with the matching username and password
    const signupCredential = await LoginCredential.findOne({ username });

    if (signupCredential) { 
      console.log("User name already taken",req.body);
      // If a matching document is found, send a success response
      res.send({ status: 'False' });
    } else {
      try {
        res.send({ status: 'True' });
        await LoginCredential.create({ username: username, password: hash, usertype: userType, status: "unactive" ,date:date});
          console.log('User updated successfully:',req.body);
        } catch (error) {
          console.error('Error while updating user:', error.message);
        }      
    }
  } catch (error) {
    // Handle any errors that occur
    console.error(error);
    res.status(500).send({ error: 'Internal server error' });
  }
});app.get('/UserCheck', authenticateToken, async (req, res) => {
  const authorizationHeader = req.headers.authorization;
  const token = authorizationHeader.split(' ')[1];
  const decodedToken = jwt.decode(token);
  if (decodedToken.username) {
    const user = await LoginCredential.findOne(
      { username: decodedToken.username },
      { usertype: 1 }
    );
    console.log(user);
    if (user && (user.usertype === 'Admin' || user.usertype === 'society president')) {
      res.send(true);
      console.log("if");
    } else {
      console.log("else");
      res.send(false);
    }
  }
});
app.get('/Requests', authenticateToken,async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
 
  try {
    //to display all the requests that are on pending
    const SendedRequests = await LoginCredential.find({ status:"unactive" }, { username: 1 , date:1 });
    if (SendedRequests) { 
      console.log("doc found",SendedRequests);
      res.send(SendedRequests) 
    }
  } catch (error) {
    // Handle any errors that occur
    console.error(error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
//for deleting the request that have been send for approval
app.delete('/Requests', authenticateToken,async (req, res) => {
  const username = req.body.username;
  await LoginCredential.deleteOne({username: username});
  res.send('True');
});
//for accepting request
app.post('/Requests',authenticateToken, async(req,res)=>{
  const username  = req.body.data.username;
  console.log(username)
  await LoginCredential.updateOne({username:username},{status: "Active"})
  res.send("True")
})

app.get('/Home',authenticateToken,async(req,res)=>{
  data = await EventsData.find({},{EventOrganizers:1,
Place:1,time:1,about:1,DateHeld:1,EventName:1,image:1,likes:1,TicketPrice:1})
  const message = `Welcome, ${req.user.username}!`;
  res.send(data);
});
const upload = multer({ dest: 'uploads/' });
app.post('/modal',authenticateToken,upload.single('image'), async (req, res) => {
  
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' });
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    // do something with decoded token
  
  // console.log(req.body);
  // console.log(req.token);
  const imageData = fs.readFileSync(req.file.path);
  dateTimeString = req.body.date
  const [date_, time_] = dateTimeString.split('T');
  const formattedDate = moment(date_).format('MM-DD-YYYY'); 
  await EventsData.create({EventName:req.body.eventName,DateHeld:formattedDate,createBy:decodedToken.username,EventOrganizers:req.body.organizerName,Place:req.body.address,about:req.body.discription,image:imageData,time:time_,TicketPrice:req.body.ticketsPrice})
  res.send("response send")  
  }
    catch{}
});
//for students 
app.delete('/delEventsUserTypeCheck', authenticateToken, async (req, res) => {
  const decoded = jwt.decode(req.body.token, { complete: true });
  if (decoded.payload.username) {
    const user = await LoginCredential.findOne(
      { username: decoded.payload.username },
      { usertype: 1 }
    );
    if (user && user.usertype === "Admin") {
      res.send(true)
    } else {
    const eventsOfStudent = await EventsData.find({ createBy: decoded.payload.username });
   console.log(eventsOfStudent)
    res.send(eventsOfStudent)
  }
  }
});


//for admin
app.delete('/delEvents', authenticateToken, async (req, res) => {
  try {
    const deletedEvent = await EventsData.deleteOne({ EventName: req.body.EventName });
    console.log(`Document deleted: ${deletedEvent}`);
    const remainingData = await EventsData.find({},{about:1,DateHeld:1,EventName:1,image:1})
    console.log(remainingData)
    res.send(remainingData);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting document');
  }
});
//for students
app.delete('/delEventsstd', authenticateToken, async (req, res) => {
  try {
    const deletedEvent = await EventsData.deleteOne({ EventName: req.body.EventName });
    console.log(`Document deleted: ${deletedEvent}`);
    const decoded = jwt.decode(req.body.token, { complete: true });
    console.log("name:",decoded.payload.username)
    const remainingData = await EventsData.find({createBy:decoded.payload.username},{about:1,DateHeld:1,EventName:1,image:1})
    console.log(remainingData)
    res.send(remainingData);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting document');
  }
});
//get data for edit the preexisting event
app.get('/getEventdata', authenticateToken, async (req, res) => {
  try {const eventName = req.query.EventName;
    const Data = await EventsData.find({EventName: eventName})
    res.send(Data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error getting document');
  }
});


app.get('/Home',authenticateToken,async(req,res)=>{
  data = await EventsData.find({},{about:1,DateHeld:1,EventName:1,image:1})
  const message = `Welcome, ${req.user.username}!`;
  res.send(data);
});const upload2 = multer({ dest: 'uploads/' });

app.post('/modalEdit', authenticateToken, upload2.single('image'), async (req, res) => {
  console.log(req.body);

  const updateFields = {
    EventName: req.body.eventName,
    createBy: req.body.createBy,
    EventOrganizers: req.body.organizerName,
    Place: req.body.address,
    about: req.body.discription,
    TicketPrice:req.body.ticketsPrice
  };
  
  if (req.file) {
    const imageData = fs.readFileSync(req.file.path);
    updateFields.image = imageData;
  }
  
  const dateTimeString = req.body.date;
  const [date_, time_] = dateTimeString.split('T');
  const formattedDate = moment(date_).format('MM-DD-YYYY'); 
 
  await EventsData.updateOne({ _id: req.body.id }, { ...updateFields, DateHeld: formattedDate, time: time_ });
  res.send("response send");  
});

app.post('/Event', authenticateToken, async (req, res) => {
  
const authorizationHeader = req.headers.authorization;
const token = authorizationHeader.split(' ')[1];
const decodedToken = jwt.decode(token);
findUser = await EventsLikes.findOne({username:decodedToken.username,EventName:req.body.eventname},{LikeStatus:1})
if(findUser){
  res.send(false)
}
else if(!findUser){
  console.log("fannafna",req.body.eventname)
  if(req.body.data=="like"){
    await EventsLikes.create({username:decodedToken.username,EventName:req.body.eventname,LikeStatus:true})
    await EventsData.updateOne({EventName:req.body.eventname}, { $inc: { likes: 1 } })  
    res.send(true)
    }
}
})

app.get('/checkphoto',authenticateToken,async(req,res)=>{
  const authorizationHeader = req.headers.authorization;
  const token = authorizationHeader.split(' ')[1];
  const decodedToken = jwt.decode(token);
  findUser = await profileData.findOne({username:decodedToken.username},{image:1})
  if (findUser){
  res.send({ success: true, data: findUser })}
})



const save = multer({ dest: 'uploads/' });
app.post('/photosave', authenticateToken, save.single('image'), async (req, res) => {
  console.log(req.file)
  const authorizationHeader = req.headers.authorization;
  const token = authorizationHeader.split(' ')[1];
  const decodedToken = jwt.decode(token);
  const imageData = fs.readFileSync(req.file.path);
  findUser = await profileData.findOne({username:decodedToken.username})
  if (findUser){
    res.send({ success: false, data: imageData })
  }
  else{  
    if (req.file) {
    saving = await profileData.create({username:decodedToken.username,image:imageData})
    if (saving){
      res.send({ success: true, data: imageData })
    }
  }
  }
})
app.get('/findorganizers', authenticateToken, async (req, res) => {
  try {
    const organizers = await EventsData.find({}, { EventOrganizers: 1 }).exec();
    res.send(organizers);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3002,() => {
  console.log('Server is listening');
});
module.exports = app;