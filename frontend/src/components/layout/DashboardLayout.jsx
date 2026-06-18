import { NavLink, useNavigate, Navigate } from "react-router-dom";
import { roleUsers, sidebarDefs } from "../../data/siteConfig";
import { useToast } from "../common/ToastProvider";

export default function DashboardLayout({ role, page, sidebarOpen, setSidebarOpen, children }) {
  const navigate = useNavigate();
  const authStr = localStorage.getItem("am_auth");
  
  if (!authStr) {
    // Safety check; DashboardRoutePage should have already handled this.
    return <Navigate to="/login" replace />;
  }

  const auth = JSON.parse(authStr);
  const user = {
    name: auth.name || "User",
    title: auth.title || "User",
    initials: auth.initials || "U"
  };
  const sections = sidebarDefs[role] ?? [];
  const { showToast } = useToast();

  const logout = () => {
    localStorage.removeItem("am_auth");
    showToast("Logged out successfully", "info");
    navigate("/login");
  };

  return (
    <div className="dashboard">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <img src="/assets/logo.png" alt="AssembleMonitor" />
          <span className="sidebar-brand">
            Assemble<span>Monitor</span>
          </span>
        </div>

        {sections.map((section, sectionIndex) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            <nav className="sidebar-nav">
              {section.items.map((item) => {
                const to = item.slug === "index" ? `/${role}` : `/${role}/${item.slug}`;
                return (
                  <NavLink
                    key={item.slug}
                    to={to}
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    {item.text}
                  </NavLink>
                );
              })}
              {sectionIndex === sections.length - 1 && (
                <>
                  <div className="divider" />
                  <button type="button" className="sidebar-logout-btn" onClick={logout}>
                    <span className="material-symbols-outlined">logout</span>
                    Logout
                  </button>
                </>
              )}
            </nav>
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user.initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">{user.title}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-icon-btn"
              id="sidebarToggle"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <div className="topbar-title">{page.title}</div>
              <div className="topbar-breadcrumb">{page.breadcrumb}</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-avatar">{user.initials}</div>
          </div>
        </header>

        <div className="dash-content">{children}</div>
      </div>
    </div>
  );
}
