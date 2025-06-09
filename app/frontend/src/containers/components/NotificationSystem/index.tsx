import React from "react";
import NotificationSystemComponent from "./NotificationSystemComponent";

interface NotificationProps {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
  onClose: () => void;
}

const NotificationSystem: React.FC<NotificationProps> = (props) => {
  return <NotificationSystemComponent {...props} />;
};

export default NotificationSystem;
