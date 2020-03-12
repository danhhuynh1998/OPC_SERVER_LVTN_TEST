/* global require */
var async = require('asyncawait/async');
var await = require('asyncawait/await');
const opcua = require('node-opcua');
var ip = require("ip");
var os = require ("os");
var path = require("path");

//datatype mapping Var and OPC UA standards
const moduleTypesMap =
{
    'Bool' : 'Boolean',
    'Real' : 'Float',
    'Double' : 'Double',
    'Byte' : 'Byte',
    'Int' : 'Int16',
    'DInt' : 'Int32',
    'LInt' : 'Int64',
    'UInt' : 'UInt16',
    'UDInt' : 'UInt32',
    'ULInt' : 'UInt64',
    'String' : 'String',
    'Word' : 'UInt16',
    'DWord' : 'UInt32',
};
const moduleTypesCodeMap =
{
    'Boolean' : opcua.DataType.Boolean,
    'Float' : opcua.DataType.Float,
    'Double' : opcua.DataType.Double,
    'Byte' : opcua.DataType.Byte,
    'Int16' : opcua.DataType.Int16,
    'Int32' : opcua.DataType.Int32,
    'Int64' : opcua.DataType.Int64,
    'UInt16' : opcua.DataType.UInt16,
    'UInt32' : opcua.DataType.UInt32,
    'UInt64' : opcua.DataType.UInt64,
    'String' : opcua.DataType.String
};
function opcuaInitializeAsync(server)
{
    return new Promise(function(res, err)
    {
        server.initialize(function ()
        {
            return res();
        });
	});
}
function opcuaStartAsync (server)
{
    return new Promise(function (res, err)
    {
            server.start(function ()
            {
                const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
                console.log("The primary Server endpoint URL is", endpointUrl);
                return res();
            });
    });
}

module.exports.startAsync = async (function (appConfig)
{
    let moduleData = {};
    //Read hostname and IPAddress
    var hostname = os.hostname();
    var ipAddress = ip.address();

    //Set some Options
    let options = {};
    options.maxAllowedSessionNumber = 500;
    options.maxConnectionsPerEndpoint = 500;
    options.port = appConfig.serverConfig.port;
    // options.resourcePath = "/ua/node-opcua";
    options.alternateHostname = ipAddress;
    options.buildInfo =
    {
        productName: hostname,
        buildNumber: "1",
        buildDate: new Date(2019,1,1)
    };
    options.serverInfo =
    {
        applicationUri : "urn:"+ hostname + ":ua/node-opcua",
        productUri : "node-opcua",
        applicationName : {text: "node-opcua", locale:"en"},
        gatewayServerUri : null,
        discoveryProfileUri : null,
        discoveryUrls : []
    };


    // if ((appConfig.serverConfig.certificateFile.includes (".pem")) && (appConfig.serverConfig.privateKeyFile.includes (".pem")))
    // {
    //     options.certificateFile = appConfig.serverConfig.certificateFile;
    //     options.privateKeyFile = appConfig.serverConfig.privateKeyFile;
    // }
    // options.serverCertificateManager = new opcua.OPCUACertificateManager({
    //     automaticallyAcceptUnknownCertificate: true,
    //     rootFolder: path.join(__dirname, "../certs")
    // });
    // //set user management
    options.allowAnonymous = appConfig.serverConfig.allowAnonymous;
    // // Use accounts for identity verification if Anonymous is not allowed
    // if (!options.allowAnonymous)
    // {
    //     let usrManager = {};
    //     usrManager.isValidUser = function(userName, password)
    //     {
    //         //for each user in users list
    //         for (let i = 0; i < appConfig.serverConfig.userList.length; i++)
    //         {
    //             let uName = appConfig.serverConfig.userList[i].user;
    //             let uPass = appConfig.serverConfig.userList[i].password;

    //             if ((uName === userName) && (uPass === password))
    //             {
    //                 //authenticate
    //                 return true;
    //             }
    //         }
    //         return false;
    //     };
    //     options.userManager = usrManager;
    // }


 // Build server object
    moduleData.server = new opcua.OPCUAServer(options);

    // Initalize the server
    try
    {
        await (opcuaInitializeAsync(moduleData.server));
    }
    catch (e)
    {
        console.log("OPCUA Server initialization failed : " + e);
    }

    // Build address space
    const addressSpace = moduleData.server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    moduleData.uaNodeList = [];

    //for each device add one folder and its variables
    function opcuaAddDevice(nameDevice, DataSet, uaNodeList, addressSpace, namespace)
{
    // Add device object node to the namespace
    let device = namespace.addObject({
        organizedBy : addressSpace.rootFolder.objects,
        browseName : nameDevice
    });

    // Add each tag (variable) to server
    for( let j = 0; j < DataSet.variablesList.length; j++){
        let variable = DataSet.variablesList[j];
        let setID = 's="' + nameDevice + '"."' + variable.name + '"';
        let myValue = variable.value;
        setInterval(function(){  myValue+=1; }, 500);
        if (!DataSet.variablesList[j].writable)
        {

        namespace.addVariable({
            componentOf: device,
            browseName: variable.name,
            dataType: moduleTypesMap[variable.dataType],
            nodeId: setID,
            value: {
                get: function () {
                    let mydataType = moduleTypesCodeMap[moduleTypesMap[variable.dataType]];
                    return new opcua.Variant({dataType: mydataType, value: myValue });
                },
                set: function (variant) {
                    return opcua.StatusCodes.BadNotWritable;
                }
            }
        });
    }
    else {

        namespace.addVariable({
            componentOf: device,
            browseName: variable.name,
            dataType: moduleTypesMap[variable.dataType],
            nodeId: setID,
            value: {
                get: function () {
                    let mydataType = moduleTypesCodeMap[moduleTypesMap[variable.dataType]];
                    return new opcua.Variant({dataType: mydataType, value: myValue });
                },
                set: function (variant) {
                    myValue = parseFloat(variant.value);
                    return opcua.StatusCodes.Good;
                }
            }
        });

    }
    }
    uaNodeList.push(device);
}

    for (let i = 0; i < appConfig.SimulationData.length; i++)
    {
        let nameDevice = appConfig.SimulationData[i].deviceName;
        opcuaAddDevice(nameDevice, appConfig.SimulationData[i], moduleData.uaNodeList, addressSpace, namespace);

    }


    // const myDevices = namespace.addFolder(addressSpace.rootFolder.objects, { browseName: "MyDevices" });
    // const node = namespace.addAnalogDataItem({

    //     organizedBy: myDevices,

    //     nodeId: "s=TemperatureAnalogItem",
    //     browseName: "TemperatureAnalogItem",
    //     definition: "(tempA -25) + tempB",
    //     valuePrecision: 0.5,
    //     engineeringUnitsRange: { low: 100, high: 200 },
    //     instrumentRange: { low: -100, high: +200 },
    //     engineeringUnits: opcua.standardUnits.degree_celsius,
    //     dataType: "Double",
    //     value: {
    //       get: function() {
    //         return new opcua.Variant({ dataType: opcua.DataType.Double, value: Math.random() + 19.0 });
    //       }
    //     }
    //   });

    // const viewsFolder = addressSpace.findNode("ViewsFolder");
    // const view = namespace.addView({
    //     organizedBy: viewsFolder,
    //     browseName: "MyView"
    // });
    // namespace.addView({
    //     organizedBy: addressSpace.rootFolder.views,
    //     browseName: "SampleView",
    //     nodeId: "s=SampleView"
    //   });
    //method1
    const myObject = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "ObjectWithMethods"
    });
    const methodIO = namespace.addMethod(myObject, {

        ///xx modellingRule: "Mandatory",

        browseName: "MethodIO",
        nodeId: opcua.makeNodeId("MethodIO", namespace.index),

        inputArguments: [
            {
                name: "ShutterLag",
                description: { text: "specifies the number of seconds to wait before the picture is taken " },
                dataType: opcua.DataType.Double
            }
        ],

        outputArguments: [
            {
                name: "Result",
                description: { text: "the result" },
                dataType: "Int32"
            }
        ]
    });
    methodIO.bindMethod(function(inputArguments, context, callback) {
        // console.log(require("util").inspect(context).toString());
        const callMethodResult = {
            statusCode: opcua.StatusCodes.Good,
            outputArguments: [
                {
                    dataType: opcua.DataType.Int32,
                    value: 42
                }
            ]
        };
        callback(null, callMethodResult);
    });
    //method2
    const myDevice = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "MyDevice"
    });

    const method = namespace.addMethod(myDevice,{

        browseName: "Bark",

        inputArguments:  [
            {
                name:"nbBarks",
                description: { text: "specifies the number of time I should bark" },
                dataType: opcua.DataType.UInt32
            },{
                name:"volume",
                description: { text: "specifies the sound volume [0 = quiet ,100 = loud]" },
                dataType: opcua.DataType.UInt32
            }
         ],

        outputArguments: [{
             name:"Barks",
             description:{ text: "the generated barks" },
             dataType: opcua.DataType.String ,
             valueRank: 1
        }]
    });

    // optionally, we can adjust userAccessLevel attribute
    method.outputArguments.userAccessLevel = opcua.makeAccessLevelFlag("CurrentRead");
    method.inputArguments.userAccessLevel = opcua.makeAccessLevelFlag("CurrentRead");


    method.bindMethod((inputArguments,context,callback) => {

        const nbBarks = inputArguments[0].value;
        const volume =  inputArguments[1].value;

        console.log("Hello World ! I will bark ",nbBarks," times");
        console.log("the requested volume is ",volume,"");
        const sound_volume = Array(volume).join("!");

        const barks = [];
        for(let i=0; i < nbBarks; i++){
            barks.push("Whaff" + sound_volume);
        }

        const callMethodResult = {
            statusCode: opcua.StatusCodes.Good,
            outputArguments: [{
                    dataType: opcua.DataType.String,
                    arrayType: opcua.VariantArrayType.Array,
                    value :barks
            }]
        };
        callback(null,callMethodResult);
    });
    try
    {
        await (opcuaStartAsync(moduleData.server));
    }
    catch (e)
    {
        console.log("OPCUA Server start failed : " + e);
    }

    console.log("OPCUA Server started.");
    //store some values from server and make the magic..
    moduleData.connected = true;
    let port = moduleData.server.endpoints[0].port;
    moduleData.endpointUrl = moduleData.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
    console.log("OPCUA Server is now listening on port", port,"(press CTRL+C to stop Server).");
    moduleData.server.on("create_session",function(session){
        console.log(session.clientDescription.applicationName.text.toString());
    })
    return moduleData;
});


