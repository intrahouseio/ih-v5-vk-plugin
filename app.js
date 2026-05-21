const util = require('util');
const path = require('path');
const { VK } = require('vk-io');

module.exports = async function (plugin) {
    const unitid = plugin.opt.id;
    const token = plugin.params.token;
    const apiVersion = plugin.params.apiVersion || '5.199';
    const allowNotRegister = plugin.params.allowNotRegister;
    const vk = new VK({ token: token, apiVersion: apiVersion });

    let users;

    (async () => {
        try {
            async function startbot() {
                try {
                    await vk.updates.start();
                    plugin.log('✅ VK bot is started');
                    ///////////////////////////////////////////////////////////////////////////////////////


                    ///////////////////////////////////////////////////////////////////////////////////////
                    vk.updates.on('message_new', async (context) => {
                        //plugin.log("Context: " + util.inspect(context))
                        try {
                            if (context.isOutbox) return;

                            const userid = context.senderId;
                            const userObj = users.find(user => user.addr == Number(userid)) || undefined;
                            const user = userObj ? userObj.userId : undefined;
                            const register = user ? true : false;
                            const text = (context.text || '').trim();
                            const img = getImg(context.getAttachments("photo"));
                            const audio = getAudio(context.getAttachments("audio"));
                            const audio_message = getAudioMessage(context.getAttachments("audio_message"));
                            const doc = getDoc(context.getAttachments("doc"));
                            const geo = context.geo ? context.geo : false;

                            const sendtosystem = {
                                userid: userid,
                                user: user,
                                register: register,
                                text: text,
                                img: img,
                                doc: doc,
                                audio: audio,
                                audio_message: audio_message,
                                geo: geo,
                                ts: Date.now()
                            }

                            plugin.log("📩 Incom message: " + util.inspect(sendtosystem), 1);

                            if (!register) {
                                const newuserstr = `User ${userid} not register. Send your ID to the administrator`;
                                await context.reply(newuserstr);
                                plugin.log(newuserstr, 1);
                                return;
                            }

                            if (allowNotRegister || register) {
                                process.send({ type: 'procinfo', data: { msg: JSON.stringify(sendtosystem) } });
                            }

                        } catch (error) {
                            plugin.log("Error new message: " + error)
                        }
                    })
                } catch (err) {
                    plugin.log('❌ VK bot start error:', err);
                    plugin.exit(1);
                }
            }

            async function getusers() {
                process.send({ type: 'sub', id: unitid, event: 'sendinfo', filter: { type: unitid } });
                process.send({ type: 'get', tablename: 'infousers', allfields: true });
            }


            async function procmsg(msg) {
                //plugin.log(util.inspect(msg))
                if (typeof msg === 'object' && msg !== undefined) {

                    if (msg.type === "get" && msg.hasOwnProperty("infousers")) {
                        users = [...msg.infousers];
                    }

                    if (msg.type === "sub" && msg.id === unitid && msg.event === "sendinfo") {
                        if (msg.data) {
                            const dest = msg.data.dest;
                            const text = msg.data.txt;
                            const peers = msg.data.sendTo.map(user => user.addr);
                            let attachment = false;

                            if (msg.data.hasOwnProperty("pdf")) { attachment = { type: "document", value: msg.data.pdf } }
                            if (msg.data.hasOwnProperty("img")) { attachment = { type: "photo", value: msg.data.img } }

                            plugin.log(`Send message: ${dest} text: ${text}`, 1)

                            await sendMsg(peers, text, attachment)
                        }
                        else {
                            plugin.log("No has data...")
                        }
                    }
                }
                else {
                    plugin.log("Unknown proc message...")
                }
            }


            async function sendMsg(peers, text, attachment) {
                try {
                    const senddata = { peer_ids: peers, random_id: (Math.floor(Math.random()) * 1000 * Date.now()) }

                    if (text) {
                        senddata["message"] = text
                    }

                    if (attachment) {
                        if (attachment.type == "photo") {
                            const photo = await uploadPhoto(peers, attachment.value);
                            senddata["attachment"] = photo.toString();
                        }
                        if (attachment.type == "document") {
                            const doc = await uploadDocument(peers, attachment.value);
                            senddata["attachment"] = doc.toString();
                        }
                    }

                    await vk.api.messages.send(senddata);
                } catch (error) {
                    plugin.log("Send error: " + error)
                }

            }

            async function uploadPhoto(peers, photoSource) {
                const photo = await vk.upload.messagePhoto({
                    peer_id: Array.isArray(peers) ? peers[0] : peers,
                    source: {
                        value: photoSource
                    }
                });
                return photo;
            }

            async function uploadDocument(peers, docSource) {
                const doc = await vk.upload.messageDocument({
                    peer_id: Array.isArray(peers) ? peers[0] : peers,
                    source: {
                        value: docSource,
                        filename: path.basename(docSource)
                    },
                    title: path.basename(docSource) || 'document'
                });
                return doc;
            }

            function getImg(images) {
                if (images.length == 0) return false;
                const imgarr = [];
                images.forEach(image => {
                    imgarr.push({ low: image.smallSizeUrl, med: image.mediumSizeUrl, high: image.largeSizeUrl })
                });
                return imgarr;
            }

            function getAudio(audios) {
                if (audios.length == 0) return false;
                const audioarr = [];
                audios.forEach(audio => {
                    audioarr.push({ duration: audio.duration, url: audio.url })
                });
                return audioarr;
            }

            function getAudioMessage(audiomessages) {
                if (audiomessages.length == 0) return false;
                const audiomessagesarr = [];
                audiomessages.forEach(audiomessage => {
                    audiomessagesarr.push({ duration: audiomessage.duration, mp3: audiomessage.mp3Url, ogg: audiomessage.oggUrl })
                });
                return audiomessagesarr;
            }

            function getDoc(docs) {
                if (docs.length == 0) return false;
                const docarr = [];
                docs.forEach(doc => {
                    docarr.push({ title: doc.title, url: doc.url })
                });
                return docarr;
            }


            process.on('message', msg => {
                //plugin.log(util.inspect(msg))
                procmsg(msg)
            });

            plugin.onChange('infousers', data => {
                process.send({ type: 'get', tablename: 'infousers' });
            });

            plugin.onChange('params', data => {
                process.exit(0);
            });

            await startbot();
            await getusers();
        } catch (error) {
            plugin.log("Error: " + error)
        }
    })();
}
