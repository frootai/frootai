import React from "react";
import ReactDOM from "react-dom/client";
import Sidebar from "./panels/Sidebar";
import "./sidebar.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sidebar />
  </React.StrictMode>
);
