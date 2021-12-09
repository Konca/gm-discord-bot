const Discord = require("discord.js");
const fetch = require("node-fetch");

const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    "GUILD_MEMBERS",
  ],
});

const prefix = "£";
client.once("ready", () => {
  console.log("bot is on");
});

client.on("messageCreate", (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    message.channel.send("Pong!");
  } else if (command === "createguild") {
    getMembers(message.guild.id).then((members) => {
      const GInfo = {
        Name: args[0],
        Nick: args[1],
        Id: message.guild.id,
        Members: members,
      };
      saveHandler(GInfo, "Guilds/" + GInfo.Id).then((res) => {
        if (res === 200) {
          message.author.send(
            "Guild '" + args[0] + "' (" + args[1] + ") created"
          );
        } else
          message.author.send("Failed to connect to database, try again later");
      });
    });
  } else if (command === "help")
    message.channel.send(
      "Use '£createguild GuildName GN' (GN is the name abbreviation) to create or update your guild"
    );
  else if (command === "uploadraid") {
    fetch("https://raid-helper.dev/api/event/" + args[0])
      .then((data) => {
        if (data.ok) {
          data.json().then((dataJSON) => {
            if (dataJSON.serverid !== undefined) {
              const raidEvent = {
                Name: dataJSON.title,
                Description: dataJSON.description,
                ID: args[0],
                Date: dataJSON.date,
                Time: dataJSON.time,
                SortedRaids: [
                  {
                    TeamName: "Raid 1",
                    TeamComp: [
                      {
                        Class: "Warrior",
                        ID: "237969307995209729",
                        Name: "Tsourapo",
                        Role: "Tank",
                        Spec: "Protection",
                      },
                    ],
                  },
                  { TeamName: "Benched" },
                ],
              };
              saveHandler(raidEvent, message.guild.id + "/" + args[0]);

              fetch(
                "https://guild-manager-720d2-default-rtdb.europe-west1.firebasedatabase.app/" +
                  message.guild.id +
                  "/raids.json"
              ).then((raidData) => {
                raidData.json().then((raidDataJSON) => {
                  const index =
                    raidDataJSON === null
                      ? 0
                      : raidDataJSON.findIndex((x) => x.ID === args[0]) === -1
                      ? raidDataJSON.length
                      : raidDataJSON.findIndex((x) => x.ID === args[0]);

                  const raidInfo = {
                    Date: dataJSON.date,
                    Name: dataJSON.title,
                    ID: args[0],
                  };
                  saveHandler(raidInfo, message.guild.id + "/raids/" + index);
                });
              });
              message.channel.send("Event uploaded successfully")} else
              message.channel.send(
                "Upload " + dataJSON.status + ", Reason: " + dataJSON.reason
              );
          });
        } else message.channel.send("Raid Helper not reachable");
      })
  } else message.channel.send("type '£help' for more info");
});
const saveHandler = async (saveData, path) => {
  const res = await fetch(
    "https://guild-manager-720d2-default-rtdb.europe-west1.firebasedatabase.app/" +
      path +
      ".json",
    {
      method: "PUT",
      body: JSON.stringify(saveData),
      headers: { "Content-Type": "application/json" },
    }
  );
  return res.status;
};

const getMembers = (serverId) => {
  const server = client.guilds.cache.get(serverId);
  const allMembers = [];
  return server.members.fetch().then((members) => {
    // Loop through every members
    members.forEach((member) => {
      allMembers.push({
        Name: member.displayName,
        Id: member.id,
        Role: member.roles.highest.name,
      });
    });
    return allMembers;
  });
};

const getUsers = async (serverId) => {};
client.login("Tokenhere");

//https://discord.com/oauth2/authorize?client_id=915190870083506197&scope=bot&permissions=423860104288
