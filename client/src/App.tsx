import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Applications from "./pages/Applications";
import Docker from "./pages/Docker";
import Podman from "./pages/Podman";
import Kubernetes from "./pages/Kubernetes";
import Ansible from "./pages/Ansible";
import Terraform from "./pages/Terraform";
import AIAssistant from "./pages/AIAssistant";
import Logs from "./pages/Logs";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Topology from "./pages/Topology";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/applications" component={Applications} />
        <Route path="/containers/docker" component={Docker} />
        <Route path="/containers/podman" component={Podman} />
        <Route path="/kubernetes" component={Kubernetes} />
        <Route path="/infrastructure/ansible" component={Ansible} />
        <Route path="/infrastructure/terraform" component={Terraform} />
        <Route path="/ai-assistant" component={AIAssistant} />
        <Route path="/logs" component={Logs} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/settings" component={Settings} />
        <Route path="/topology" component={Topology} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
