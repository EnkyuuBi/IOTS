// Telegraf scaffold for telegram bot
const {Telegraf} = require('telegraf');
const https = require('https');

// dotenv for private keys
require('dotenv').config();
const bot = new Telegraf(process.env.TELEGRAM_BOT_API_KEY);

// Logging into firebase
const admin = require ('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");
const { get } = require('http');
const { connect } = require('http2');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Start command, connects with firestore 
bot.command('/start', async (ctx) => {
    ctx.reply("Hi! \n\nTo start, please key in this command with the session id you have received: /init <session id> \n\nOnce you receive a message saying that you're ready, open any door by keying in the id on its face with the command: /door <session id> <door number>");
})

// Init command, activates a session by finding the corresponding ID with the telegram client's phone number
// It's a big mess but it works trust me

bot.command('/init', (ctx) => 
{
    const commands = ctx.message.text;
    const args = commands.split(" ");

    if(args.length != 2)
    {
        ctx.reply("invalid parameters! Key in /init <session id>")
        return;
    }
    
    const id = args[1];
    
    ctx.reply("Verifying a session ID");

    ctx.reply("Please send your contact to confirm your phone number", {
        reply_markup: {
            keyboard: [
                [
                {
                    text: "📲 Send phone number",
                    request_contact: true,
                },
                ],
            ],
            one_time_keyboard: true,
            },
        }).then(() =>
        {
            bot.on('contact', (ctx) =>
            {
                const contact = ctx.message.contact.phone_number;
                const number = contact.substring(1);
                ctx.reply('Checking for sessions under ' + number + '...');
                db.collection('Sessions').where('Phone Number', '==', number).get().then((query) =>
                {
                    if(!query.empty)
                    {
                        const sessionDoc = query.docs[0];
                        const sessionData = sessionDoc.data();
                        if(sessionData["Session ID"] == id)
                        {
                            ctx.reply("Session found.").then(() =>
                            {
                                if(sessionData["Is Session Active"] == true)
                                {
                                    ctx.reply("Session is already open, please proceed.");
                                    return;
                                }
                                db.collection('Sessions').doc(sessionDoc.id).update({
                                    "Is Session Active": true,
                                }).then(()=>{
                                    ctx.reply("You're ready! Whenever you need to open a door, type /open <Session ID> <Door ID>");
                                }).catch((error) => {
                                    ctx.reply("error checking document, please try again");
                                    console.log(error);
                                })
                            })
                        }
                        else // No matching Session ID
                        {
                            ctx.reply("No Session found")
                        }
                    }
                    else // Query is empty
                    {
                        ctx.reply("No Session found")
                    }
                    // Giant chunk of then statement endings
                })
            })
        })
})

bot.command('/door', (ctx) => {
    const commands = ctx.message.text;
    const args = commands.split(" ");

    if(args.length != 3)
    {
        ctx.reply("invalid parameters! Key in /door <session id> <door id>")
        return;
    }
    
    const sessionID = args[1];
    const doorID = args[2];
    
    db.collection('Sessions').where('Session ID', '==', sessionID).get().then((query) =>
    {
        if(!query.empty)
        {
            if(query.docs[0].data()["Is Session Active"] == true)
            {
                if(query.docs[0].data()["Door permissions"].find(element => element == doorID))
                {
                    ctx.reply("Opening door");
                    // TODO: MQTT stuff
                    // TODO: Update the database with the door that has opened
                }
                else // Door ID not recognised or not allows
                {
                    ctx.reply("Door id invalid");
                }
            }
            else // "Is Session Active" is false
            {
                ctx.reply("Session isn't active, begin it with /init")
            }
        }
        else // Query was empty
        {
            ctx.reply("Session doesn't exist or was closed");
        }
    })
    
})
bot.launch()