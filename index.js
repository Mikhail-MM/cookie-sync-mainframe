const express = require('express');
const path = require('path');
const uuidv4 = require('uuid/v4');
const cookieParser = require('cookie-parser')

const mongoose = require('mongoose');
const mongoDBuri = `mongodb://${process.env.MLABS_USER}:${process.env.MLABS_PW}@ds137581.mlab.com:37581/cookie-sync-mainframe` 

mongoose.Promise = global.Promise; 
mongoose.connect(mongoDBuri, { useNewUrlParser: true });

const Schema = mongoose.Schema;

const ClientSchema = new Schema({
	ipRange: [String],
	audienceTrackingID: String,
	partner1TrackingID: String,
	mainframeTrackingID: String,
	contentFocus: String,
});

const Client = mongoose.model('Client', ClientSchema);

const app = express();

app.use(cookieParser());

app.use('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://cookie-sync-partner-1.herokuapp.com, https://cookie-sync-audience-service.herokuapp.com");
  res.header("Access-Control-Allow-Headers", "Origin, partner_1_tracking_id, X-Requested-With, Content-Type, Accept, x-audience-tracking-id, x-partner-1-tracking-id, x-contentFocus");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

app.use('/', (req, res, next) => {
	console.log("Logging Forwarded-For Client IP ", req.headers["x-forwarded-for"])
	console.log("Logging Proxy IP ", req.ip)
	console.log("LOGGING COOKIES: ", req.cookies)
	console.log(" ")
	next();
});

app.get('/sync', async (req, res, next) => {
	try {
		console.log("Mainframe Receives Sync Request")
		console.log(" ")
		//console.log("logging full request",  req)
		console.log("Logging important headers:")
		console.log(req.headers['x-audience-tracking-id'])
		console.log(req.headers['x-partner-1-tracking-id'])
		console.log(req.headers['x-mainframe-tracking-id'])
		console.log(req.headers['x-original-ip'])
		console.log(true && req.headers['x-mainframe-tracking-id'])  // undefined
		console.log(typeof(req.headers['x-mainframe-tracking-id']))

			const updatedClient = await Client.findOneAndUpdate(
			{ 	$or: [{
					
					ipRange: { $elemMatch: { $eq: req.headers['x-original-ip'] } },
					
					audienceTrackingID: req.headers['x-audience-tracking-id'],
					partner1TrackingID: req.headers['x-partner-1-tracking-id'],
					mainframeTrackingID: req.headers['x-mainframe-tracking-id'],
				
				}]
			}, {
				
				$addToSet: { ipRange: req.headers['x-original-ip'] },
				
				audienceTrackingID: req.headers['x-audience-tracking-id'],
				partner1TrackingID: req.headers['x-partner-1-tracking-id'],
				mainframeTrackingID: req.headers['x-mainframe-tracking-id'],
				contentFocus: req.headers['x-contentfocus'],

			}, { new: true, upsert: true })

			console.log("Did we get dis client doe?")
			console.log(updatedClient)

			res.status(200).json(updatedClient)

	} catch(err) { next(err) }
});

app.get('/adworks', async (req, res, next) => {
	try {
		console.log("Query Headers:")
				console.log(req.headers['x-audience-tracking-id'])
				console.log(req.headers['x-partner-1-tracking-id'])
				console.log(req.headers['x-mainframe-tracking-id'])
				console.log("QUERYING:")

		const clientMatch = await Client.findOne({
			$or: [
				{ ipRange: req.headers['x-original-ip'] || '' },	
				{ audienceTrackingID: req.headers['x-audience-tracking-id'] || '' },
				{ partner1TrackingID: req.headers['x-partner-1-tracking-id'] || ''},
			]
		})
		console.log(clientMatch)
		const tryThis = await Client.findOne({partner1TrackingID: req.headers['x-partner-1-tracking-id']})
		const ipMatch = await Client.findOne({ipRange: req.headers['x-original-ip']})
		console.log(tryThis)
		console.log(ipMatch)
		console.log('QUERY COMPLETE')
		const { contentFocus } = clientMatch
		console.log("Sending Content Focus: ", contentFocus)
			res.sendFile(path.join(__dirname + `/${contentFocus}.jpg`))
	} catch(err) { next(err) }
})

app.get('*', (req, res) => {
	console.log("Catch-All Handler")
	res.status(200).send("All Clear Chief.")
});


app.use(function(err, req, res, next) {
	console.log(err)
	res.status(err.status || 500).send();
});


const port = process.env.PORT || 1000;

app.listen(port);

console.log(`Audience Service Host listening on ${port}`);