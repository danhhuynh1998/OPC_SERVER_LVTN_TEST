/* global require */
var async = require('asyncawait/async');
var await = require('asyncawait/await');
//read config file
const appConfig = require("./config/appconfig.json");
//opcua server import
var OPCUAServer = require('./models/OPCUA_SERVER');
var Start = async (function ()
{
				try
				{
					//Create OPC UA Server
					console.log ('Start OPCUA Server...');
					var OPCServer = await (OPCUAServer.startAsync (appConfig));
				}
				catch (e)
				{
				console.log (e);
				}
});
//________MAIN________//
Start();




