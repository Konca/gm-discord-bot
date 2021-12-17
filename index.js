const Discord = require("discord.js");
const fetch = require("node-fetch");

const firebase = require("firebase");
// Required for side-effects
require("firebase/firestore");

const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    "GUILD_MEMBERS",
  ],
});
const firebaseConfig = require("./assets/key/guild-manager.json");
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

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
    getGuildData(message.guild.id).then((guildData) => {
      const GInfo = {
        Name: args[0],
        Server: args[1],
        Id: message.guild.id,
        Members: guildData.Members,
        Roles: guildData.Roles,
      };
      saveHandler(GInfo, {
        saveDoc: "guild",
        guildId: message.guild.id,
      }).then((res) => {
        message.author.send(res);
      });
    });
  } else if (command === "help")
    message.channel.send(
      ///include list of servers to xcheck
      "Use '£createguild Guild-Name RGN-Server-Name' (RGN can be US,EU,KR,TW) to create or update your guild"
    );
  else if (command === "readraid") {
    readHandler({
      loadDoc: "raid",
      guildId: message.guild.id,
      raidId: args[0],
    }).then((data) => {
      console.log(data.SortedRaids);
      message.channel.send("raid ID: " + data.Id);
    });
  }

  //
  else if (command === "uploadraid") {
    fetch("https://raid-helper.dev/api/event/" + args[0]).then((data) => {
      if (data.ok) {
        data.json().then((dataJSON) => {
          if (dataJSON.serverid !== undefined) {
            const raidEvent = sortNewRaid(
              {
                Name: dataJSON.title,
                Description: dataJSON.description,
                ID: args[0],
                Date: firebase.firestore.Timestamp.fromDate(dataJSON.date),///FIX THIS AND  ITS GOOOD!
                Time: dataJSON.time,
              },
              dataJSON.signups
            );
            readHandler({
              loadDoc: "raid",
              guildId: message.guild.id,
              raidId: args[0],
            }).then((data) => {
              if (data === undefined) {
                //console.log(raidEvent)
                //Object.keys(raidEvent.SortedRaids.RaidMembers).forEach(even=>console.log(raidEvent.SortedRaids.RaidMembers[even]))
                saveHandler(raidEvent, {saveDoc:"raid",
                  guildId: message.guild.id,
                  raidId: args[0],
                });
              }
            });
            message.channel.send("Event uploaded successfully");
          } else
            message.channel.send(
              "Upload " + dataJSON.status + ", Reason: " + dataJSON.reason
            );
        });
      } else message.channel.send("Raid Helper not reachable");
    });
  } else message.channel.send("type '£help' for more info");
});
const readHandler = async (path) => {
  if (path.loadDoc === "guild") {
    return;
  }
  if (path.loadDoc === "raid") {
    return db
      .collection("guilds")
      .doc(path.guildId)
      .collection("raids")
      .doc(path.raidId)
      .get()
      .then((data) => data.data());
  }
};
const saveHandler = async (saveData, path) => {
  if (path.saveDoc === "guild") {
    return db
      .collection("guilds")
      .doc(path.guildId)
      .collection("raids")
      .doc(path.raidId)
      .set(saveData)
      .then((docRef) => {
        return "Command carried out successfully!!";
      })
      .catch((error) => {
        return "Error handling request... " + error;
      });
  }
  if (path.saveDoc === "raid") {
    console.log(path)
    return db
      .collection("guilds")
      .doc(path.guildId)
      .collection("raids")
      .doc(path.raidId)
      .set(saveData)
      .then((docRef) => {
        return "Command carried out successfully!!";
      })
      .catch((error) => {
        return "Error handling request... " + error;
      });
  }
};

const getGuildData = async (serverId) => {
  const server = client.guilds.cache.get(serverId);
  const allMembers = [];
  const allRoles = [];
  await server.members.fetch().then((members) => {
    // Loop through every members
    members.forEach((member) => {
      allMembers.push({
        Name: member.displayName,
        Id: member.id,
        Role: member.roles.highest.name,
      });
    });
  });
  await server.roles.fetch().then((roles) => {
    roles.forEach((role) => {
      allRoles[role.rawPosition] = {
        Name: role.name,
        ID: role.id,
      };
    });
  });
  const sortedRoles = allRoles.reverse();
  return { Members: allMembers, Roles: sortedRoles };
};

const formatRaidKeyVals = (element) => {
  const newElement = {
    Class: element.class,
    ID: element.userid,
    Name: element.name,
    Role: element.role,
    Spec: element.spec,
    Status: element.status,
    AssignedTo: "Nothing",
  };

  if (newElement.Role === "Absence") newElement.AssignedTo = "Absent";
  if (
    newElement.Role === "Absence" ||
    newElement.Role === "Tentative" ||
    newElement.Role === "Late" ||
    newElement.Role === "Bench"
  ) {
    newElement.Status = element.Role;
  } else {
    newElement.Status = "Signed";
  }
  switch (newElement.Spec) {
    case "Protection":
      newElement.Class = "Warrior";
      newElement.Role = "Tank";
      break;
    case "Protection1":
      newElement.Role = "Tank";
      newElement.Spec = "Protection";
      newElement.Class = "Paladin";
      break;
    case "Guardian":
      newElement.Class = "Druid";
      newElement.Role = "Tank";
      break;
    case "Restoration":
      newElement.Class = "Druid";
      newElement.Role = "Healer";
      break;
    case "Restoration1":
      newElement.Spec = "Restoration";
      newElement.Class = "Shaman";
      newElement.Role = "Healer";
      break;
    case "Holy":
    case "Discipline":
      newElement.Class = "Priest";
      newElement.Role = "Healer";
      break;
    case "Holy1":
      newElement.Spec = "Holy";
      newElement.Class = "Paladin";
      newElement.Role = "Healer";
      break;
    case "Arms":
    case "Fury":
      newElement.Class = "Warrior";
      newElement.Role = "Melee-DPS";
      break;
    case "Feral":
      newElement.Class = "Druid";
      newElement.Role = "Melee-DPS";
      break;
    case "Retribution":
      newElement.Class = "Paladin";
      newElement.Role = "Melee-DPS";
      break;
    case "Combat":
    case "Assassination":
    case "Subtlety":
      newElement.Class = "Rogue";
      newElement.Role = "Melee-DPS";
      break;
    case "Enhancement":
      newElement.Class = "Shaman";
      newElement.Role = "Melee-DPS";
      break;

    case "Balance":
      newElement.Class = "Druid";
      newElement.Role = "Ranged-DPS";
      break;
    case "Beastmastery":
    case "Marksmanship":
    case "Survival":
      newElement.Class = "Hunter";
      newElement.Role = "Ranged-DPS";
      break;
    case "Shadow":
      newElement.Class = "Priest";
      newElement.Role = "Ranged-DPS";
      break;
    case "Fire":
    case "Arcane":
    case "Frost":
      newElement.Class = "Mage";
      newElement.Role = "Ranged-DPS";
      break;
    case "Destruction":
    case "Demonology":
    case "Affliction":
      newElement.Class = "Warlock";
      newElement.Role = "Ranged-DPS";
      break;
    case "Elemental":
      newElement.Class = "Shaman";
      newElement.Role = "Ranged-DPS";
      break;
    default:
      return[]
      break;
  }
  return [newElement];
};

const sortNewRaid = (raidInfo, raidcomp) => {
  const formattedComp = raidcomp.flatMap((x) => formatRaidKeyVals(x));
  formattedComp.sort((s1, s2) =>
    s1.Spec < s2.Spec ? 1 : s1.Spec > s2.Spec ? -1 : 0
  );
  formattedComp.sort((c1, c2) =>
    c1.Class < c2.Class ? 1 : c1.Class > c2.Class ? -1 : 0
  );
  const raidObj = {
    SortedRaids: {
      RaidInfo: { ...raidInfo },
      RaidMembers: { ...formattedComp },
    },
  };
  return raidObj;
};

client.login("OTE1MTkwODcwMDgzNTA2MTk3.YaX_6g.JplwoAxhw9pIMXu8qF3EMjx_btw");

//https://discord.com/oauth2/authorize?client_id=915190870083506197&scope=bot&permissions=423860104288
