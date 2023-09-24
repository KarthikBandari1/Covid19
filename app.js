const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
module.exports = app;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertDbObjectToResponseObjectDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//getting all the states
app.get("/states/", authenticateToken, async (request, response) => {
  const query = `select * from state;`;
  const statesArray = await db.all(query);
  response.send(
    statesArray.map((each) => convertDbObjectToResponseObject(each))
  );
});

//getting a single state
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const query = `select * from state where state_id=${stateId};`;
  const state_ = await db.get(query);
  response.send(convertDbObjectToResponseObject(state_));
});

//creating a entry in district
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `insert into district(district_name,
  state_id,
  cases,
  cured,
  active,
  deaths) values('${districtName}',
  '${stateId}',
  '${cases}',
 '${cured}',
  '${active}',
  '${deaths}');`;
  await db.run(query);
  response.send("District Successfully Added");
});

//getting a single district
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `select * from district where district_id=${districtId};`;
    const state_ = await db.get(query);
    response.send(convertDbObjectToResponseObjectDistrict(state_));
  }
);

//delete a district
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `delete from district where district_id=${districtId};`;
    await db.run(query);
    response.send("District Removed");
  }
);

//update
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const query = `
update district set
district_name='${districtName}',
state_id='${stateId}',
cases='${cases}',
cured= '${cured}',
active='${active}',
deaths='${deaths}';
`;
    await db.run(query);
    response.send("District Details Updated");
  }
);

//getting stats based in state id
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `select sum(cases),sum(cured),sum(active),sum(deaths) from district where state_id=${stateId};`;
    const stats = await db.get(query);
    console.log(stats);
    response.send({
      totalCases: stats["sum(cases)"],
      totalCured: stats["sum(cured)"],
      totalActive: stats["sum(active)"],
      totalDeaths: stats["sum(deaths)"],
    });
  }
);

//get state of district
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `select state_name as stateName from state natural join district where district_id=${districtId};`;
    const state_ = await db.get(query);
    response.send(state_);
  }
);

//login
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
