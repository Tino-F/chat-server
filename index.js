var express = require('express'),
	bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser'),
	expresssession = require('express-session'),
	path = require('path'),
	multer = require('multer'),
	mime = require('mime'),
	crypto = require('crypto'),
	algorithm = 'aes-256-ctr',
	password = 'e5dfed20def956c1fa4eea83106e6bf2',
	passport = require('passport'),
	passportlocal = require('passport-local'),
	MongoClient = require('mongodb').MongoClient,
	url = 'mongodb://localhost:27017/database',
	ui = require('./ui');

var app = express();

function encrypt (text) {
	var cipher = crypto.createCipher(algorithm,password);
	var crypted = cipher.update(text, 'utf8', 'hex');
	crypted += cipher.final('hex');
	return crypted;
};

function decrypt (text) {
	var decipher = crypto.createDecipher(algorithm,password)
	var dec = decipher.update(text,'hex','utf8')
	dec += decipher.final('utf8');
	return dec;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(expresssession({
	secret: 'ayylmaomyfriend',
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs'); 

var storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, __dirname + '/public/uploads/')
		},
		filename: function (req, file, cb) {
			crypto.pseudoRandomBytes(16, function (err, raw) {
				cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype));
			});
		}
	});

var upload = multer({storage: storage});

passport.use(new passportlocal.Strategy(function (username, password, done){
	var query = {username: username};
	MongoClient.connect(url, function (err, db) {
		if(!err){
			var Profiles = db.collection('Profiles');

			Profiles.find(query).limit(1).toArray(function (err, item) {
				if (!item[0]) {
					done(null, null);
				} else {
					if (item[0].password === encrypt(password)){
						var user = item[0];
						done(null, user);
					} else {
						done(null, null);
					}
				}
			});
		} else {
			console.log('Failed to connect to database.');
		}
	});
}));

passport.serializeUser(function (user, done) {
	done(null, user);
});

passport.deserializeUser(function (user, done) {
	done(null, user);
})

app.get('/register', ui.register);
app.post('/register', multer(upload).fields([{name: 'profile_pic', maxCount: 1, },{name: 'profile_background', maxCount: 1}]), ui.submit_reg);

app.get('/login', ui.login);
app.post('/login', passport.authenticate('local'), ui.submit_log);
app.get('/logout', function (req, res) {
	req.logout();
	res.redirect('/login');
})

app.get('/user/:id', ui.user);

app.get('/edit', ui.edit);
app.post('/edit', multer(upload).fields([{name: 'new_profilepic', maxCount: 1}, {name: 'new_backgroundpicture', maxCount: 1}]), ui.edit_upd);

app.get('/create', ui.create);
app.post('/create', multer(upload).single('room_background'), ui.create_sub);

app.get('/room/:id', ui.room);
app.post('/room/:id', ui.room_upd);
app.get('/room/:id/edit', ui.room_edit);
app.post('/room/:id/edit', multer(upload).single('new_background_image'), ui.room_edit_upd);
app.post('/room/:id/deletemessage/', ui.room_delete_message);
app.get('/private/:id', ui.private_room);
app.post('/private/:id', ui.private_upd);
app.post('/privatepass/:id', ui.private_submit_pass)
app.get('/private/:id/edit', ui.room_edit);
app.post('/private/:id/edit', multer(upload).single('new_background_image'), ui.room_edit_upd)
app.post('/private/:id/deletemessage', ui.private_delete_message);

app.get('/random', ui.random);

app.get('/find/:id', ui.find);
app.get('/yourprofile', ui.you);

app.get('/', ui.home);
app.get('', ui.home);

app.listen(4000);
console.log('Listening on port 4000.')