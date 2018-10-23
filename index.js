const express = require('express');
const path = require('path');
const uuidv4 = require('uuid/v4');
const cookieParser = require('cookie-parser')
const serveStatic = require('serve-static')

const app = express();

app.use(cookieParser());

app.use('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://cookie-sync-partner-1.herokuapp.com, https://cookie-sync-audience-service.herokuapp.com");
  res.header("Access-Control-Allow-Headers", "Origin, partner_1_tracking_id, X-Requested-With, Content-Type, Accept, x-audience-tracking-id, x-partner_1_tracking_id, x-contentFocus");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

app.use('/', (req, res, next) => {
	console.log("Logging Forwarded-For Client IP ", req.headers["x-forwarded-for"])
	console.log("Logging Proxy IP ", req.ip)
	console.log("LOGGING COOKIES: ", req.cookies)
	console.log(" ")
	// Problem: This will never stop sending a UUID - the request is bounced from partner 1, and the only cookie it should ever have is from partner 1. This will be a control via headers
	// This does not work - we can't set cookies for this domain from an indirect piped request. Spoofing the domain just gets it ignored by the useragent
	if (!req.cookies['mainframe_tracking_id']) {
		console.log('Piped Request To Mainframe Does Not Have UUID.')
		const uniqueID = uuidv4();
		res.setHeader('Set-Cookie', [`mainframe_tracking_id=${uniqueID}`]);
	}
	next();
});

app.get('/sync', (req, res, next) => {
	console.log("Mainframe Receives Sync Request")
	console.log(" ")
	//console.log("logging full request",  req)
	console.log("Logging headers: ", req.headers)
		res.status(200).send('Syncing Requisites')
});

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