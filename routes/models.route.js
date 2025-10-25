const { authenticateToken, restrictTo } = require("../controllers/auth.controller");
const { createController } = require("../controllers/generic.controller")
const { selectAll, selectOne, createOne, updateOne, deleteOne } = require("../utils/handlerFactory")
const express = require("express")
const route = express.Router({ mergeParams: true }) // mergeParams is needed to access :models from parent router

route.use(authenticateToken);

route.get("/", restrictTo('Admin'),createController(selectAll));

route.get("/:id", createController(selectOne));

route.post("/", createController(createOne));

route.put("/:id", createController(updateOne));

route.delete("/:id",createController(deleteOne));

module.exports = route