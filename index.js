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
const botToken = require("./assets/key/bot-token.json");

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
        Roles: guildData.Roles,
      };
      saveHandler(GInfo, {
        saveDoc: "guild",
        guildId: message.guild.id,
      }).then((res) => {
        saveHandler(
          { ...guildData.Members },
          {
            saveDoc: "members",
            guildId: message.guild.id,
          }
        );
        message.author.send(res);
      });
    });
  } else if (command === "updatemembers") {
    getGuildData(message.guild.id).then((guildData) => {
      saveHandler(
        { ...guildData.Members },
        {
          saveDoc: "members",
          guildId: message.guild.id,
        }
      );
      message.author.send(res);
    });
  } else if (command === "help")
    message.channel.send(
      ///include list of servers to xcheck
      "Use '£createguild Guild-Name RGN-Server-Name' (RGN can be US,EU,KR,TW) to create or update your guild. \n" +
        "Use '£updatemembers' to update the guild member list. \n" +
        "Use '£uploadraid RaidId' to upload the selected raid to the webpage."
    );
  else if (command === "readraid") {
    readHandler({
      loadDoc: "raid",
      guildId: message.guild.id,
      raidId: args[0],
    }).then((data) => {
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
                CreatorName: dataJSON.leadername,
                CreatorId: dataJSON.leaderid,
                Name: dataJSON.title,
                Description: dataJSON.description,
                Id: args[0],
                Date: firebase.firestore.Timestamp.fromMillis(
                  +dataJSON.unixtime * 1000
                ),
              },
              dataJSON.signups
            );
            readHandler({
              loadDoc: "raid",
              guildId: message.guild.id,
              raidId: args[0],
            }).then((data) => {
              if (data !== undefined) {
                const updatedRaidEvent=updateRaidMembers(raidEvent, data);
                saveHandler(updatedRaidEvent, {
                  saveDoc: "raid",
                  guildId: message.guild.id,
                  raidId: args[0],
                });
              } else {
                saveHandler(raidEvent, {
                  saveDoc: "raid",
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
  message.delete();
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
      .set(saveData)
      .then((docRef) => {
        return "Command carried out successfully!!";
      })
      .catch((error) => {
        return "Error handling request... " + error;
      });
  }
  if (path.saveDoc === "raid") {
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
  if (path.saveDoc === "members") {
    return db
      .collection("guilds")
      .doc(path.guildId)
      .collection("members")
      .doc("AllMembers")
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
        Id: role.id,
      };
    });
  });
  const sortedRoles = allRoles.reverse();
  return { Members: allMembers, Roles: sortedRoles };
};

const formatRaidKeyVals = (element) => {
  const newElement = {
    Class: element.class,
    Id: element.userid,
    Name: element.name,
    Role: element.role,
    Spec: element.spec,
    Status: "Signed",
    AssignedTo: "Nothing",
  };
  if (newElement.Class === "Absence") newElement.AssignedTo = "Absent";
  if (
    newElement.Class === "Absence" ||
    newElement.Class === "Tentative" ||
    newElement.Class === "Late" ||
    newElement.Class === "Bench"
  ) {
    newElement.Status = newElement.Class;
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
      return [];
  }
  return [newElement];
};
const sortRaid = (members)=>{
  members.sort((s1, s2) =>
    s1.Spec < s2.Spec ? 1 : s1.Spec > s2.Spec ? -1 : 0
  );
  members.sort((c1, c2) =>
    c1.Class < c2.Class ? 1 : c1.Class > c2.Class ? -1 : 0
  );
  return members
}
const sortNewRaid = (raidInfo, raidcomp) => {
  const formattedComp = raidcomp.flatMap((x) => formatRaidKeyVals(x));
  const sortedComp= sortRaid(formattedComp)
  const raidObj = {
    ...raidInfo,
    SortedRaids: {
      RaidInfo: { 0: "Raid1" },
      RaidMembers: { ...sortedComp },
    },
  };
  return raidObj;
};
const updateRaidMembers = (newRaid, oldRaid) => {
  const raidToUpload = newRaid;
  const membersToUpload = [];
  const newRaidMembers = {};
  const oldRaidMembers = {};
  Object.keys(newRaid.SortedRaids.RaidMembers).forEach((key) => {
    newRaidMembers[newRaid.SortedRaids.RaidMembers[key].Id] =
      newRaid.SortedRaids.RaidMembers[key];
  });
  Object.keys(oldRaid.SortedRaids.RaidMembers).forEach((key) => {
    const oldMember = oldRaid.SortedRaids.RaidMembers[key];
    if (newRaidMembers[oldMember.Id] !== undefined) {
      oldMember.Spec = newRaidMembers[oldMember.Id].Spec;
      oldMember.Class = newRaidMembers[oldMember.Id].Class;
      oldMember.Role = newRaidMembers[oldMember.Id].Role;
      oldMember.Status = newRaidMembers[oldMember.Id].Status;
      oldRaidMembers[oldMember.Id] = oldMember;
    }
  });
  Object.keys(newRaidMembers).forEach((key) => {
    const newMember = newRaidMembers[key];
    if (oldRaidMembers[newMember.Id] === undefined) {
      membersToUpload.push (newMember)
    }
    else{
      membersToUpload.push( oldRaidMembers[newMember.Id])
    }
  });
  const sortedMembersToUpload=sortRaid(membersToUpload)
  raidToUpload.SortedRaids.RaidMembers = {...sortedMembersToUpload};
  raidToUpload.SortedRaids.RaidInfo = oldRaid.SortedRaids.RaidInfo;
  return raidToUpload;
};

client.login(botToken.token);

//https://discord.com/oauth2/authorize?client_id=915190870083506197&scope=bot&permissions=423860104288
