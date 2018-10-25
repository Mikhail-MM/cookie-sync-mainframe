const express = require('express');
const path = require('path');
const uuidv4 = require('uuid/v4');
const cookieParser = require('cookie-parser')
const rp = require('request-promise')
const request = require('request')

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
	console.log("LOGGING COOKIES: ", req.cookies)
	console.log(" ")
	next();
});

app.get('/sync', async (req, res, next) => {
	try {
			const updatedClient = await Client.findOneAndUpdate(
			{ 	$or: [
					{ ipRange: { $elemMatch: { $eq: req.headers['x-original-ip'] || '' } } },
					{ audienceTrackingID: req.headers['x-audience-tracking-id'] || '' },
					{ partner1TrackingID: req.headers['x-partner-1-tracking-id'] || '' },
					{ mainframeTrackingID: req.headers['x-mainframe-tracking-id'] || '' }]
			}, {
				
				$addToSet: { ipRange: req.headers['x-original-ip'] },
				
				audienceTrackingID: req.headers['x-audience-tracking-id'],
				partner1TrackingID: req.headers['x-partner-1-tracking-id'],
				mainframeTrackingID: req.headers['x-mainframe-tracking-id'],
				contentFocus: req.headers['x-contentfocus'],

			}, { new: true, upsert: true })

			console.log("Did Client Update?")
			console.log(updatedClient)

			res.status(200).json(updatedClient)

	} catch(err) { next(err) }
});

app.get('/adworks', async (req, res, next) => {
	try {
		const clientMatch = await Client.findOne({
			$or: [
				// { ipRange: req.headers['x-original-ip'] || '' },	
				{ audienceTrackingID: req.headers['x-audience-tracking-id'] || '' },
				{ partner1TrackingID: req.headers['x-partner-1-tracking-id'] || '' },
			]
		})
			if (clientMatch) {
				res.sendFile(path.join(__dirname + `/${contentFocus}.jpg`))
			} else {
				res.sendFile(path.join(__dirname + `/Unknown.jpg`))
			}
	} catch(err) { next(err) }
})

app.get('/prebid', async (req, res, next) => {
	try{
		if (!req.cookies['mainframe_tracking_id']) {
			const uniqueID = uuidv4();
			res.setHeader('Set-Cookie', [`mainframe_tracking_id=${uniqueID}`]);
		}
		const bids = await Promise.all([rp('https://cookie-sync-partner-2.herokuapp.com/bidding').json(), rp('https://cookie-sync-partner-1.herokuapp.com/bidding').json()])
		const clientMatch = await Client.findOne({
			$or: [
				// { ipRange: req.headers['x-original-ip'] || '' },	
				{ audienceTrackingID: req.headers['x-audience-tracking-id'] || '' },
				{ partner1TrackingID: req.headers['x-partner-1-tracking-id'] || ''},
			]
		})
		console.log(bids)
		console.log(bids[0].bid)
		console.log(Math.max(bids[0].bid, bids[1].bid))
		const winningBid = bids.reduce((a, b) => Math.max(a.bid, b.bid));
		console.log(winningBid)
		const { origin, bid } = winningBid;
			if (clientMatch) {
				request(`${origin}/partnerAd/${clientMatch.contentFocus}.jpg`).pipe(res)
			} else {
				request(`${origin}/partnerAd/Unknown.jpg`).pipe(res)
			}
	} catch(err) { next(err) }
})

app.get('/timed-prebid', async (req, res, next) => {
	try {
		const fastBid = await Promise.race([
			rp('https://cookie-sync-partner-1.herokuapp.com/bidding').json(), 
			rp('https://cookie-sync-partner-2.herokuapp.com/bidding').json()]
		)
		console.log(fastBid)
		console.log(fastBid)
		const clientMatch = await Client.findOne({
			$or: [
				// { ipRange: req.headers['x-original-ip'] || '' },	
				{ audienceTrackingID: req.headers['x-audience-tracking-id'] || '' },
				{ partner1TrackingID: req.headers['x-partner-1-tracking-id'] || ''},
			]
		})
			if (clientMatch) {
				request(`${fastBid.origin}/partnerAd/${clientMatch.contentFocus}.jpg`).pipe(res)
			} else {
				request(`${fastBid.origin}/partnerAd/Unknown.jpg`).pipe(res)
			}
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