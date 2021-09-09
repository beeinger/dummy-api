require("dotenv").config();
const app = require("fastify")();
const { Deta } = require("deta");

const deta = Deta(process.env.PROJECT_KEY);
const db = deta.Base("simple_db");

const faker = require("faker");

const user = {
    name: { type: "string" },
    surname: { type: "string" },
    email: { type: "string", format: "email" },
    dob: { type: "string" },
    profilePicture: { type: "string" },
    theme: { type: "string" },
    description: { type: "string" },
  },
  respUser = {
    type: "object",
    required: ["email", "name", "surname"],
    properties: user,
  },
  respUsers = {
    type: "array",
    items: respUser,
  };

app.register(require("fastify-swagger"), {
  routePrefix: "/",
  tags: [
    { name: "greeting", description: "Greeting related end-points" },
    { name: "user", description: "User related end-points" },
    { name: "admin", description: "Admin related end-points" },
  ],
  uiConfig: {
    deepLinking: false,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  exposeRoute: true,
  swagger: {
    info: {
      title: "Dummy JSON API",
    },
    definitions: {
      User: {
        type: "object",
        required: ["name", "surname", "email", "theme"],
        properties: user,
      },
    },
  },
});

app.get(
  "/greeting",
  {
    schema: {
      description: "sends a greeting to the world",
      summary: "hello world",
      tags: ["greeting"],
      response: {
        200: {
          description: "Successful response",
          type: "string",
        },
      },
    },
  },
  async (request, reply) => {
    return "Hello world!";
  }
);

app.post(
  "/greeting",
  {
    schema: {
      description: "sends a greeting to a person",
      summary: "greet user",
      tags: ["greeting"],
      body: { name: { type: "string", description: "user name" } },
      response: {
        200: {
          description: "Successful response",
          type: "string",
        },
      },
    },
  },
  async (request, reply) => {
    return `Hello ${request.body.name}!`;
  }
);

app.get(
  "/user",
  {
    schema: {
      description: "gets all users",
      summary: "get all users",
      tags: ["user"],
      response: {
        200: {
          description: "Successful response",
          ...respUsers,
        },
      },
    },
  },
  async (request, reply) => {
    let res = await db.fetch(),
      allItems = res.items;

    while (res.last) {
      res = await db.fetch({}, { last: res.last });
      allItems = [...allItems, ...res.items];
    }

    return allItems;
  }
);

app.get(
  "/user/:email",
  {
    schema: {
      description: "gets a user",
      summary: "get a user",
      tags: ["user"],
      params: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "user email",
          },
        },
      },
      response: {
        200: {
          description: "Successful response",
          ...respUser,
        },
      },
    },
  },
  async (request, reply) => {
    let user = await db.get(request.params.email);

    return user;
  }
);

app.put(
  "/user",
  {
    schema: {
      description: "creates a new user",
      summary: "create a user",
      tags: ["user"],
      body: user,
      response: {
        200: {
          description: "Successful response",
          ...respUser,
        },
      },
    },
  },
  async (request, reply) => {
    const _user = await db.put(request.body, request.body.email);
    return _user;
  }
);

app.patch(
  "/user/:email",
  {
    schema: {
      description: "change user data",
      summary: "edit user",
      tags: ["user"],
      params: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "user email",
          },
        },
      },
      body: user,
      response: {
        200: {
          description: "Successful response",
          ...respUser,
        },
      },
    },
  },
  async (request, reply) => {
    await db.update(request.body, request.params.email);

    return request.body;
  }
);

app.delete(
  "/user/:email",
  {
    schema: {
      description: "delete user",
      summary: "delete a user",
      tags: ["user"],
      params: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "user email",
          },
        },
      },
      response: {
        200: {
          description: "Successful response",
          type: "string",
        },
      },
    },
  },
  async (request, reply) => {
    if (!request.params.email) return "Failure";
    await db.delete(request.params.email);

    return "Success";
  }
);

app.put(
  "/db/feed",
  {
    schema: {
      description: "feeds the database with 25 sample data entries",
      summary: "feed database",
      tags: ["admin"],
      response: {
        200: {
          description: "Successful response",
          ...respUsers,
        },
      },
    },
  },
  async (request, reply) => {
    let users = [];

    for (let i = 0; i < 25; i++) {
      const email = faker.internet.email();

      users.push({
        name: faker.name.firstName(),
        surname: faker.name.lastName(),
        email,
        dob: faker.date
          .between(new Date(63072001000), new Date(1009843201000))
          .toDateString(),
        profilePicture: faker.image.animals(),
        theme: faker.datatype.boolean() ? "dark" : "light",
        description: faker.lorem.paragraph(),
        key: email,
      });
    }

    const { processed } = await db.putMany(users);

    return processed.items || [];
  }
);

app.delete(
  "/db/dump",
  {
    schema: {
      description: "dumps the whole database, clears all data",
      summary: "dump database",
      tags: ["admin"],
      response: {
        200: {
          description: "Successful response",
          ...respUsers,
        },
      },
    },
  },
  async (request, reply) => {
    let res = await db.fetch(),
      allItems = res.items;

    while (res.last) {
      res = await db.fetch({}, { last: res.last });
      allItems = [...allItems, ...res.items];
    }

    allItems = await Promise.all(
      allItems.map(async (item) => {
        await db.delete(item.key);
        return item;
      })
    );

    return allItems;
  }
);

app.ready((err) => {
  if (err) throw err;
  app.swagger();
});

app.register(require("fastify-cors"), { origin: "*" });

module.exports = app;
