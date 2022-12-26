const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let dbpath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
let db = null;

let initializationDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log(`server starting at http://localhost:3000/`);
    });
  } catch (e) {
    console.log(`db error ${e.message}`);
    process.exit(1);
  }
};
initializationDbAndServer();

let authenticate = (request, response, next) => {
  let authheader = request.headers["authorization"];
  let jwttoken;
  if (authheader !== undefined) {
    jwttoken = authheader.split(" ")[1];
  }

  if (jwttoken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwttoken, "manohar", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  let checkquery = `SELECT * FROM user WHERE username = '${username}';`;
  let dbresponse = await db.get(checkquery);

  if (dbresponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let checkpassword = await bcrypt.compare(password, dbresponse.password);
    if (checkpassword === true) {
      const payload = { username: username };
      let jwtToken = jwt.sign(payload, "manohar");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// get states

let statesobj = (state) => {
  return {
    stateId: state["state_id"],
    stateName: state["state_name"],
    population: state["population"],
  };
};
app.get("/states/", authenticate, async (request, response) => {
  let checkquery = `SELECT * FROM state;`;
  let dbresponse = await db.all(checkquery);
  response.send(dbresponse.map((state) => statesobj(state)));
});

//api3 state id
app.get("/states/:stateId/", authenticate, async (request, response) => {
  let { stateId } = request.params;
  let checkquery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  let dbresponse = await db.get(checkquery);
  response.send(statesobj(dbresponse));
});

//api 4 get districts
app.post("/districts/", authenticate, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  let query = `INSERT INTO 
  district(district_name,state_id,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${active},${deaths});`;
  let dbresponse = await db.run(query);
  response.status(200);
  response.send("District Successfully Added");
});

//get district api5

app.get("/districts/:districtId/", authenticate, async (request, response) => {
  let { districtId } = request.params;
  let checkquery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  let dbresponse = await db.get(checkquery);
  response.send({
    districtId: dbresponse["district_id"],
    districtName: dbresponse["district_name"],
    stateId: dbresponse["state_id"],
    cases: dbresponse["cases"],
    cured: dbresponse["cured"],
    active: dbresponse["active"],
    deaths: dbresponse["deaths"],
  });
});

//api delete state api 6
app.delete(
  "/districts/:districtId/",
  authenticate,
  async (request, response) => {
    let { districtId } = request.params;
    let checkquery = `DELETE FROM district WHERE district_id = ${districtId};`;
    let dbresponse = await db.run(checkquery);
    response.send("District Removed");
  }
);

// update api 7
app.put("/districts/:districtId/", authenticate, async (request, response) => {
  let { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  let query = `UPDATE  district 
  SET
    district_name='${districtName}',
    state_id= ${stateId},
    cases= ${cases},
    active= ${active},
    deaths= ${deaths}
    WHERE district_id = ${districtId};`;
  let dbresponse = await db.run(query);
  response.status(200);
  response.send("District Details Updated");
});

// api 8 total details
app.get("/states/:stateId/stats/", authenticate, async (request, response) => {
  let { stateId } = request.params;
  let checkquery = `SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths)
   FROM 
   district
    WHERE 
    state_id = ${stateId};`;
  let dbresponse = await db.get(checkquery);
  response.send({
    totalCases: dbresponse["SUM(cases)"],
    totalCured: dbresponse["SUM(cured)"],
    totalActive: dbresponse["SUM(active)"],
    totalDeaths: dbresponse["SUM(deaths)"],
  });
});

module.exports = app;
