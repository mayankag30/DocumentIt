const mongoose = require("mongoose");
const Document = require("./Document");

mongoose.connect(
  //   "mongodb+srv://admin:QkA48UwSJCUDjbk6@cluster0.t8yvz.mongodb.net/google_docs?retryWrites=true&w=majority",
  "mongodb://localhost/google-docs-clone",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  }
);

// Server is on port 3001
const io = require("socket.io")(3001, {
  // client and server are on different urls
  // we need cors for Cross-Origin-Support
  // to allow to make request from different url to different url
  cors: {
    origin: "http://localhost:3000",
    // socket.io does only GET and POST request
    methods: ["GET", "POST"],
  },
});

// Everytime our client connects, it runs this io connection
io.on("connection", (socket) => {
  socket.on("get-document", async (documentId) => {
    const document = await findOrCreateDocument(documentId);
    // socket joins the ROOM for that docId
    // Everyone can talk commonly with this docId
    socket.join(documentId);
    // load the document with the correct data
    socket.emit("load-document", document.data);
    socket.on("send-changes", (delta) => {
      // On our current socket, broadcast the message to everyone else
      // Except of us
      // Send the changes to a specific Room with that docId
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    // Save the document data in the doc with (id = docID)
    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(documentId, { data });
    });
  });
});

const defaultValue = "";

async function findOrCreateDocument(id) {
  if (id == null) {
    return;
  }
  const document = await Document.findById(id);
  if (document) {
    return document;
  }
  return await Document.create({ _id: id, data: defaultValue });
}
