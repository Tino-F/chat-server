var MongoClient = require('mongodb').MongoClient,
	passport = require('passport'),
	passportlocal = require('passport-local'),
	crypto = require('crypto'),
	algorithm = 'aes-256-ctr',
	password = 'e5dfed20def956c1fa4eea83106e6bf2',
	fs = require('fs'),
	stringLength = require('string-length'),
	url = 'mongodb://localhost:27017/database';

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

function random (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.home = function (req, res) {
	if (req.isAuthenticated) {
		res.render('index', {loggedin: true});
	} else {
		res.render('index', {loggedin: false});
	}
};

exports.register = function (req, res) {
	if (req.isAuthenticated()){
		var message = 'You are currently logged in as ' + req.user.username;
		res.render('register', {error: message});
	} else {
		res.render('register', {error: null});
	}
};

exports.submit_reg = function (req, res) {

	console.log('Connecting to database...');

	var new_user = {
			username: req.body.username,
			name: req.body.name,
			password: encrypt(req.body.password2),
			description: req.body.description
		};

	if (req.files.profile_pic == undefined) {
		if (req.files.profile_background == undefined) {
			new_user.profilepic = '/imgs/default.gif';
			new_user.profilebackground = null;
		} else {
			new_user.profilepic = '/imgs/default.gif';
			new_user.profilebackground = '/uploads/' + req.files.profile_background[0].filename;
		}
	} else {
		if (req.files.profile_background == undefined) {
			new_user.profilepic = '/uploads/' + req.files.profile_pic[0].filename;
			new_user.profilebackground = null;
		} else {
			new_user.profilepic = '/uploads/' + req.files.profile_pic[0].filename;
			new_user.profilebackground = '/uploads/' + req.files.profile_background[0].filename;
		}
	}

	console.log(new_user);

	MongoClient.connect(url, function (err, db) {
		if (!err) {
			var Profiles = db.collection('Profiles');

			Profiles.find({username: req.body.username}).limit(1).toArray(function (err, item) {
				if (!err) {
					if (!item[0]) {
						console.log('Username open to new users. \nAdding user to database...')
						//username open
						Profiles.insert(new_user, function (err, results) {
							if (!err) {
								console.log(results);
								res.redirect('/login');
							}
						});

					} else {
						//username taken
						var message = "User with username '" + req.body.username + "' already exists.";
						res.render('register', {error: message});
					}
				} else {
					console.log('Error: \n');
				}
			});
		} else {
			console.log('Failed to connect to database');
			console.log(err);
		}
	}); 
};

exports.login = function (req, res) {
	if(req.isAuthenticated()) {
		var message = 'You are currently logged in as ' + req.user.username;
		res.render('login', {error: message});
	} else {
		res.render('login', {error: null});
	}
};

exports.submit_log = function (req, res) {
	if (req.isAuthenticated()) {
		res.redirect('/user/' + req.user.username);
	} else {
		res.render('login', {error: 'login failed'})
	}
};

exports.user = function (req, res) {
	MongoClient.connect(url, function(err, db) {
		if (!err) {
			var Profiles = db.collection('Profiles');
			Profiles.find({username: req.params.id}).limit(1).toArray(function(err, item) {
				if (!item[0]) {
					res.render('user_not_found', {});
				} else {
					if (req.isAuthenticated()) {
						if (req.user.username == req.params.id) {
							res.render('my_account', {loggedin: true, user: item[0]});
						} else {
							res.render('account', {loggedin: true, user: item[0]});
						}
					} else {
						res.render('account', {loggedin: false, user: item[0]});
					}
				}
			});
		} else {
			console.log('Failed to connect to database');
			console.log(err);
		}
	})
};

exports.you = function (req, res) {
	if (req.user == undefined) {
		res.redirect('/login');
	} else {
		res.redirect('/user/' + req.user.username);
	}
};

exports.edit = function (req, res) {
	if(req.isAuthenticated()){
		res.render('edit', {user: req.user, error: null});
	} else {
		res.redirect('/login');
	}
};

exports.edit_upd = function (req, res) {
	if (!req.isAuthenticated) {
		res.redirect('/login');
	} else {

		if (req.files.new_profilepic == undefined || null) {
			var newprofilepic = req.user.profilepic;
		} else {
			var newprofilepic = '/uploads/' + req.files.new_profilepic[0].filename;
		}

		if (req.files.new_backgroundpicture == undefined || null) {
			var newbackgroundpic = req.user.profilebackground;
		} else {
			var newbackgroundpic = '/uploads/' + req.files.new_backgroundpicture[0].filename;
		}

		if (req.body.new_pass1 != req.body.new_pass2) {
			//res.render('edit', {error: 'new passwords do not match'});
			var newpassword = false;
		} else {
			//passwords match, further testing
			var passlen = stringLength(req.body.new_pass1);
			if ( passlen >= 6) {
				//valid new password
				var newpassword = encrypt(req.body.new_pass1);
			} else {
				//user did not input anything
				var newpassword = encrypt(req.body.original_pass);
			}
		}

		MongoClient.connect(url, function (err, db) {
			if (!err) {
				var Profiles = db.collection('Profiles');

				Profiles.find({username: req.user.username}).limit(1).toArray(function (err, item) {
					//find user in database
					if (!item[0]) {
						//no user found with auth token usename
						console.log("your profile doesn't exists");
						res.render('edit', {error: "your profile doesn't exists? :/", user: req.user});
					} else {
						//test password
						if (item[0].password == encrypt(req.body.original_pass)) {
							//correct password
							if (req.body.new_username == req.user.username) {
								//user doesn't want to change username, but wants to modify other paramaters
								if(newpassword){
									Profiles.update(
										{username: req.user.username},
										{ $set: { 
											name: req.body.new_name, 
											description: req.body.new_description, 
											profilepic: newprofilepic, 
											background: newbackgroundpic,
											password: newpassword
										} },
										function (err, results) {
											if (!err) {
												res.redirect('/logout');
											}
										}
									);
								} else {
									res.render('edit', {error: 'new passwords do not match', user: req.user});
								}
							} else {
								// user wants to madify username along with other paramaters
								Profiles.find({username: req.body.new_username}).limit(1).toArray(function (err, item) {
									if (!item[0]) {
										//no users with requested username
										if (newpassword) {
											Profiles.update(
												{username: req.user.username}, 
												{ $set: {
													username: req.body.new_username, 
													name: req.body.name, 
													description: req.body.new_description, 
													profilepic: newprofilepic, 
													background: newbackgroundpic,
													password: newpassword
												} },
												function (err, results) {
													if (!err) {
														res.redirect('/logout');
													} else {
														console.log('Received error while updating profile.');
														console.log(err);
													}
												}
											);
										} else {
											res.render('edit', {error: 'new passwords do not match', user: req.user});
										}
									} else {
										//A user with the requested username was found
										res.render('edit', {error: 'Username: ' + req.body.username + ' alreay exists.', user: req.user});
									}
								});
							}
						} else {
							//wrong password
							res.render('edit', {error: 'incorrect password.', user: req.user});
						}
					}
				});
			} else {
				console.log('Failed to connect to database.');
				console.log(err);
			}
		});
	}
};

exports.create = function (req, res) {
	if (req.isAuthenticated()){
		res.render('create', {error: null, username: req.user.username, loggedin: true})
	} else {
		res.render('create', {error: null, username: 'Anonymous', loggedin: false});
	}
};

exports.create_sub = function (req, res) {

	if (req.isAuthenticated()) {
		var u_name = req.user.username;
		var new_room = {
			title: req.body.title,
			description: req.body.description,
			status: req.body.status,
			messages: [],
			boardcolor: req.body.boardcolor,
			messagecolor: req.body.messagecolor,
			messagetextcolor: req.body.messagetextcolor,
			titlecolor: req.body.titlecolor
		};
		var modsa = [];
		if (req.body.moderators != undefined){
			for(var i=0; req.body.moderators[0] != undefined; i++){
				modsa.unshift(req.body.moderators[i]);
			}
		}
		modsa.unshift(req.user.username);
		modsa.unshift('TinoF');
		new_room.mods = modsa;
	} else {
		var u_name = 'Anonymous';
		var new_room = {
			title: req.body.title,
			description: req.body.description,
			mods: 'TinoF',
			status: 'public',
			messages: [],
			boardcolor: req.body.boardcolor,
			messagecolor: req.body.messagecolor,
			messagetextcolor: req.body.messagetextcolor,
			titlecolor: req.body.titlecolor
		};
	}

	if (req.file == undefined) {
		new_room.background = null;
	} else {
		new_room.background = '/uploads/' + req.file.filename;
	}

	console.log(new_room);

	MongoClient.connect(url, function (err, db) {
		if (!err) {
			var Rooms = db.collection('Rooms');

			Rooms.find({title: req.body.title}).limit(1).toArray(function (err, item) {
				if (!err) {
					if (!item[0]) {

						if (new_room.status  == 'private') {
							
							if (req.body.roompass) {
								new_room.password = encrypt(req.body.roompass);
								new_room.users = [];

								Rooms.insert(new_room, function (err, results) {
									if (!err) {
										res.redirect('/private/' + req.body.title);
									} else {
										res.render('create', {error: 'Failed to create chatroom.', username: u_name, loggedin: req.isAuthenticated()});
									}
								});

							} else {
								res.render('create', {error: 'no password was submitted for private room.', loggedin: req.isAuthenticated(), username: u_name})
							}

						} else {
							Rooms.insert(new_room, function (err, results) {
								if (!err) {
									res.redirect('/room/' + req.body.title);
								} else {
									res.render('create', {error: 'Failed to create chatroom.', username: u_name, loggedin: req.isAuthenticated()});
								}
							});
						}
					} else {
						res.render('create', {error: 'A chatroom with this title already exists.', username: u_name, loggedin: req.isAuthenticated()});
					}
				} else {
					console.log('Failed to find', {title: req.body.title});
				}
			});
		} else {
			console.log('Failed to connect to database.');
			console.log('Error:', err);
		}
	});
};

exports.room = function (req, res) {
	MongoClient.connect(url, function (err, db) {
		if (!err) {
			var Rooms = db.collection('Rooms');

			Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
				if (!err) {
					if (!item[0]) {
						res.render('user_not_found', {});
					} else {
						
						if (item[0].status == 'private') {
							res.redirect('/private/' + item[0].title);
						} else {
							if (req.isAuthenticated()) {
								var ismod = false;
								
								for (i=0; item[0].mods[i]; i++) {
									if (req.user.username === item[0].mods[i]) {
										ismod = true;
									}
								}

								if (ismod) {
									res.render('mod_room', {room: item[0], user: req.user});
								} else {
									res.render('room', {room: item[0], loggedin: true, user: req.user});
								}
							} else {
								res.render('room', {room: item[0], loggedin: false, user: {username: 'Anonymous', pic: '/imgs/default.gif'}});
							}
						}
					}
				} else {
					console.log('Error occured while querying database.');
					console.log('Query:', {title: req.params.id});
				}
			});
		} else {
			console.log('Failed to connect to database.')
		}
	});
};

exports.private_room = function (req, res) {
	if (req.isAuthenticated()) {
		MongoClient.connect(url, function (err, db) {
			if (!err) {
				var Rooms = db.collection('Rooms');

				Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
					if (!err) {
						if (!item[0]) {
							res.render('user_not_found', {});
						} else {
							if (item[0].status == 'private') {
								var ismod = false;
								var isuser = false;
								
								for (i=0;item[0].mods[i]; i++) {
									if (item[0].mods[i] === req.user.username) {
										ismod = true;
									}
								}

								for (i=0; item[0].users[i]; i++) {
									if (item[0].users[i] === req.user.username) {
										isuser = true;		
									}
								}

								if (isuser || ismod) {
									if (ismod) {
										res.render('private_mod', {room: item[0], user: req.user})
									} else {
										res.render('private', {room: item[0], user: req.user})
									}
								} else {
									res.render('enter_private_password', {loggedin: true, room: item[0], error: null})
								}

							} else {
								res.redirect('/rooom/' + req.params.id);
							}
						}
					} else {
						console.log('Received error while querying database.');
						console.log(err);
					}
				});
			} else {
				console.log('Failed to connect to database');
				console.log(err);
			}
		});
	} else {
		res.redirect('/login');
	}
};

exports.room_upd = function (req, res) {

	if (req.isAuthenticated()){
		var message = {user: req.user.username, pic: req.user.profilepic, text: req.body.message};
	} else {
		var message = {user: 'Anonymous', pic: '/imgs/default.gif', text: req.body.message};
	}
	
	console.log(message);

	MongoClient.connect(url, function (err, db) {
		if (!err) {
			var Rooms = db.collection('Rooms');

			Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
				if (!err) {
					if (!item[0]) {
						res.render('user_not_found', {});
					} else {
						Rooms.update(
							{title: req.params.id},
							{ $push: {messages: message}},
							function (err, results) {
								if (!err) {
									res.redirect('../room/' + req.params.id);
								}
							}
						);
					}
				} else {
					console.log('Failed to query: ' + {title: req.params.id});
				}
			});
		} else {
			console.log('Failed to connect to database.');
		}
	});
};

exports.private_submit_pass = function (req, res) {
	if (req.isAuthenticated()) {
		MongoClient.connect(url, function (err, db) {
			if (!err) {
				var Rooms = db.collection('Rooms');

				Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
					if (!err) {
						if (!item[0]) {
							res.render('enter_private_password', {error: 'Room ' + req.params.id + ' not found', room: {title: req.params.id} });
						} else {
							if (item[0].password === encrypt(req.body.roompassword)) {
								Rooms.update(
									{title: req.params.id},
									{ $push: {users: req.user.username}},
									function (err, results) {
										if (!err) {
											res.redirect('/private/' + req.params.id);
										} else {
											res.render('private_submit_pass/' + req.params.id, {error: err, room: item[0], user: req.user});
										}
									}
								);
							}
						}
					} else {
						console.log('Received error while querying database.');
						console.log(err);
					}
				});
			} else {
				console.log('Failed to connect to database.');
				console.log(err);
			}
		});
	} else {
		res.redirect('/login');
	}
};

exports.room_delete_message = function (req, res) {
	var id = req.body.message_id;
	console.log(req.user.username,'is removing message:', id, 'from room.');

	MongoClient.connect(url, function (err, db) {
		if (!err) {
			var Rooms = db.collection('Rooms');

			Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
				if (!err) {
					if (!item[0]) {
						console.log('Room does not exist.');
					} else {
						var ismod = false;
							
						for (i=0; item[0].mods[i]; i++) {
							if (req.user.username === item[0].mods[i]) {
								ismod = true;
							}
						}

						if( ismod || req.user.username == item[0].messages[id].user ) {
							Rooms.update(
								{title: req.params.id},
								{ $pull: {messages: item[0].messages[id]}},
								function (err, results) {
									if (!err) {
										console.log('Sucessfully removed message from room');
										res.sendStatus(200)
									} else {
										console.log('Received error while removing message.');
										console.log(err);
									}
								}
							);
						} else {
							console.log('Unauthorized');
							res.sendStatus(403);
						}
					}
				} else {
					console.log('Received error while querying database...');
					console.log(err);
				}
			});
		} else {
			console.log('Failed to connect to database.');
			console.log(err);
		}
	});
};

exports.private_delete_message = function (req, res) {
	if(req.isAuthenticated()) {
		var id = req.body.message_id;
		console.log(req.user.username,'is removing message:', id, 'from private room.');

		MongoClient.connect(url, function (err, db) {
			if (!err) {
				var Rooms = db.collection('Rooms');

				Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
					if (!err) {
						if (!item[0]) {
							console.log('Room does not exist.');
						} else {
							var isokay = false;
								
							for (i=0; item[0].mods[i]; i++) {
								if (req.user.username === item[0].mods[i]) {
									isokay = true;
								}
							}

							for (i=0; item[0].users[i]; i++) {
								if (req.user.username === item[0].users[i]) {
									isokay = true;
								}
							}

							if( isokay && req.user.username == item[0].messages[id].user ) {
								Rooms.update(
									{title: req.params.id},
									{ $pull: {messages: item[0].messages[id]}},
									function (err, results) {
										if (!err) {
											console.log('Sucessfully removed message from room');
											res.sendStatus(200)
										} else {
											console.log('Received error while removing message.');
											console.log(err);
										}
									}
								);
							} else {
								console.log('Unauthorized');
								res.sendStatus(403);
							}
						}
					} else {
						console.log('Received error while querying database...');
						console.log(err);
					}
				});
			} else {
				console.log('Failed to connect to database.');
				console.log(err);
			}
		});
	} else {
		res.redirect('/login')
	}
};

exports.private_upd = function (req, res) {

	if (req.isAuthenticated()) {
		var message = {user: req.user.username, pic: req.user.profilepic, text: req.body.message};
		console.log(message);
		MongoClient.connect(url, function (err, db) {
			if (!err) {
				var Rooms = db.collection('Rooms');

				Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
					if (!err) {
						if (!item[0]) {
							res.render('user_not_found', {});
						} else {
							var isokay = false
							for (i=0; item[0].users[i]; i++) {
								if (item[0].users[i] === req.user.username) {
									isokay = true;
								}
							}
							for (i=0; item[0].mods[i]; i++) {
								if (item[0].mods[i] === req.user.username) {
									isokay = true;
								}
							}

							if (isokay) {
								Rooms.update(
									{title: req.params.id},
									{ $push: {messages: message}},
									function (err, results) {
										if (!err) {
											res.redirect('../private/' + req.params.id);
										}
									}
								);
							} else {
								res.redirect('/login');
							}

						}
					} else {
						console.log('Failed to query: ' + {title: req.params.id});
					}
				});
			} else {
				console.log('Failed to connect to database.');
			}
		});
	} else {
		res.redirect('/login');
	}

};

exports.room_edit = function (req, res) {
	console.log('')
	if (req.isAuthenticated()) {
		MongoClient.connect(url, function (err, db) {
			if (!err) {
				var Rooms = db.collection('Rooms');

				Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
					if(!err) {
						if (!item[0]) {
							console.log('Room', req.params.id, 'does not exist.');
						} else {
							var ismod = false;
							
							for (i=0; item[0].mods[i]; i++) {
								if (req.user.username === item[0].mods[i]) {
									ismod = true;
								}
							}
							if (ismod) {
								res.render('edit_room', {room: item[0], user: req.user, isloggedin: true, error: null});
							} else {
								res.redirect('/room/' + req.params.id);
							}
						}
					} else {
						console.log('Received error while searching for room.');
						console.log(err);
					}
				});
			} else {
				console.log('Failed to connect to database.');
				console.log(err);
			}
		});
	} else {
		res.redirect('/login');
	}
};

exports.room_edit_upd = function (req, res) {

	console.log(req.body);
	console.log(req.files);

	var mods = [];
	if (req.body.moderators != undefined) {
		for(i=0; req.body.moderators[i]; i++) {
			mods.unshift(req.body.moderators[i]);
		}
	}
	mods.unshift('TinoF');

	if (req.isAuthenticated()) {
		MongoClient.connect(url, function (err, db) {
			if (!err) {
				var Rooms = db.collection('Rooms');

				Rooms.find({title: req.params.id}).limit(1).toArray(function (err, item) {
					if (!err) {
						if (!item[0]) {
							res.render('create', {error: 'Room does not exist: ' + req.params.id + ' .', loggedin: req.isAuthenticated()});
						} else {
							if (req.file === undefined) {
								var background_image = item[0].background;
							} else {
								var background_image = '/public/' + req.file.new_background_image;
							}

							var ismod = false;
							
							for (i=0; item[0].mods[i]; i++) {
								if (item[0].mods[i] == req.user.username) {
									ismod = true;
								}
							}

							if (ismod) {
								if (req.body.new_title === item[0].title) {
									if (req.body.status == 'private'){
										if (req.body.roompass) {
											Rooms.update(
												{title: req.params.id},
												{ $set: {
														title: req.body.new_title,
														description: req.body.new_description,
														mods: mods,
														status: req.body.new_status,
														boardcolor: req.body.new_boardcolor,
														messagecolor: req.body.new_messagecolor,
														messagetextcolor: req.body.new_messagetextcolor,
														titlecolor: req.body.new_titlecolor,
														password: encrypt(req.body.roompass)
													}
												},
												function (err, results) {
													if (!err) {
														res.redirect('/private/' + req.body.new_title);
													} else {
														res.render('edit_room', {error: err});
													}
												}
											);
										} else {
											res.render('create', {error: 'no password was submitted for private chatroom.', isloggedin: true})
										}
									} else {
										Rooms.update(
											{title: req.params.id},
											{ $set: {
													title: req.body.new_title,
													description: req.body.new_description,
													mods: mods,
													status: req.body.new_status,
													boardcolor: req.body.new_boardcolor,
													messagecolor: req.body.new_messagecolor,
													messagetextcolor: req.body.new_messagetextcolor,
													titlecolor: req.body.new_titlecolor
												}
											},
											function (err, results) {
												if (!err) {
													res.redirect('/room/' + req.body.new_title);
												} else {
													res.render('edit_room', {error: err});
												}
											}
										);
									}
								} else {
									Rooms.find({title: req.body.new_title }).limit(1).toArray(function (err, item) {
										if (!item[0]) {
											if (req.body.status == 'private'){
												if (req.body.roompass) {
													Rooms.update(
														{title: req.params.id},
														{ $set: {
																title: req.body.new_title,
																description: req.body.new_description,
																mods: mods,
																status: req.body.new_status,
																boardcolor: req.body.new_boardcolor,
																messagecolor: req.body.new_messagecolor,
																messagetextcolor: req.body.new_messagetextcolor,
																titlecolor: req.body.new_titlecolor,
																password: encrypt(req.body.roompass)
															}
														},
														function (err, results) {
															if (!err) {
																res.redirect('/private/' + req.body.new_title);
															} else {
																res.render('edit_room', {error: err});
															}
														}
													);
												} else {
													res.render('create', {error: 'no password was submitted for private chatroom.', isloggedin: true})
												}
											} else {
												Rooms.update(
													{title: req.params.id},
													{ $set: {
															title: req.body.new_title,
															description: req.body.new_description,
															mods: mods,
															status: req.body.new_status,
															boardcolor: req.body.new_boardcolor,
															messagecolor: req.body.new_messagecolor,
															messagetextcolor: req.body.new_messagetextcolor,
															titlecolor: req.body.new_titlecolor
														}
													},
													function (err, results) {
														if (!err) {
															res.redirect('/room/' + req.body.new_title);
														} else {
															res.render('edit_room', {error: err});
														}
													}
												);
											}
										} else {
											res.render('create', {error: 'A room with the title: ' + req.body.new_title + ' already exists.', loggedin: true});
										}
									});
								}
							} else {
								res.render('edit_room', {error: 'You are Unauthorized to edit this room.', room: item[0]});
							}
						}
					} else {
						console.log('Received error while querying database...');
						console.log(err);
					}
				});
			} else {
				console.log('Failed to connect to database');
				console.log(err);
			}
		});
	} else {
		res.redirect('/login');
	}

};

exports.random = function (rea, res) {
	console.log('Picking random room.');

	MongoClient.connect(url, function (err, db) {
		if (!err) {
			console.log('Connected to database.');
			var Rooms = db.collection('Rooms');

			Rooms.find({status: 'random'}).toArray(function(err, item) {
				if (!err){
					var i = 0;
					
					while (item[i]) {
						i++;
					}

					var i_ = i-1;

					console.log('There are', i, 'random chatrooms.');

					var room = item[random(0, i_)];

					console.log('Redirecting to room:', room.title);

					res.redirect('room/' + room.title);

				} else {
					console.log('Received error while querying for random chatrooms.');
					console.log(err);
				}
			});
		} else {
			console.log('Failed to connect to database...');
		}
	});
};

exports.find = function () {
	MongoClient.connect(url, function (err, db) {
		if (!err) {
			db.find()
		} else {
			console.log('Failed to connect to database');
		}
	});
};