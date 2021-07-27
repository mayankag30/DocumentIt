import { useCallback, useEffect, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";

// time (in ms) after which the doc saves it
const SAVE_INTERVAL_MS = 2000;

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

function TextEditor() {
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();

  const { id: documentId } = useParams();

  // Socket Connection and Disconnection
  useEffect(() => {
    // Enter the url of the server with port 3001
    // Connect
    const s = io("http://localhost:3001");
    setSocket(s);

    // to make sure it runs only once
    return () => {
      // After completion, DISCONNECT it
      s.disconnect();
    };
  }, []);

  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) {
      return;
    }

    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: "snow",
      modules: {
        toolbar: TOOLBAR_OPTIONS,
      },
    });
    q.disable();
    q.setText("Loading..");
    setQuill(q);
  }, []);

  // setup ROOM so that change in one doc does not change in other
  useEffect(() => {
    if (socket == null || quill == null) {
      return;
    }

    // listen to the event once
    // send the doc to the client
    socket.once("load-document", (document) => {
      // load the text editor with the contents
      quill.setContents(document);
      // disable our text editor and tell that the doc is loaded
      quill.enable();
    });

    // send to server the document id and attach a ROOM for it
    // if the doc is already saved, it returns that doc
    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  // For saving the document
  useEffect(() => {
    if (socket == null || quill == null) {
      return;
    }

    // setup a timer and after every time it saves the document
    const interval = setInterval(() => {
      // this gives us all the information to be saved to the database
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  // when quill recieves changes
  useEffect(() => {
    if (socket == null || quill == null) {
      return;
    }

    const handler = (delta) => {
      // Run the changes on our code
      // Update the document for changes from other client
      quill.updateContents(delta);
    };

    socket.on("receive-changes", handler);

    // remove this event-listener if not needed anymore
    return () => {
      socket.off("receive-changes", handler);
    };
  }, [socket, quill]);

  // when quill (text change) changes
  useEffect(() => {
    if (socket == null || quill == null) {
      return;
    }

    const handler = (delta, oldDelta, source) => {
      // track the changes which are only made by user
      if (source !== "user") {
        // Do not send the changes to server to other clients
        // unless an actual user makes them
        return;
      }

      // send changes from client to server
      // delta - the change that is made
      socket.emit("send-changes", delta);
    };

    quill.on("text-change", handler);

    // remove this event-listener if not needed anymore
    return () => {
      quill.off("text-changes", handler);
    };
  }, [socket, quill]);

  return <div className="container" ref={wrapperRef}></div>;
}

export default TextEditor;
