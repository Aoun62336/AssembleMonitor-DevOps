import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../common/ToastProvider";

const API_BASE_URL = '/api';

function getAuthToken() {
  const auth = localStorage.getItem('am_auth');
  return auth ? JSON.parse(auth).access_token : null;
}

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleDateString('en-GB',{month:'short'})} ${dt.getFullYear()}`;
};

async function apiFetch(endpoint, options = {}, navigate) {
  const token = getAuthToken();
  if (!token && !endpoint.includes('auth/login')) {
    console.warn("apiFetch: No token found, but not on login. Redirecting...");
    if (navigate) navigate('/login');
    else window.location.href = '/login';
    throw new Error('Authentication required');
  }

  const url = endpoint.startsWith('http') ? endpoint : API_BASE_URL + endpoint;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('am_auth');
    if (navigate) navigate('/login');
    else window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `API Error: ${response.status}`);
  }
  return response.json().catch(() => null);
}

/**
 * Custom Confirmation Modal Helper
 * Replaces browser's window.confirm()
 */
function confirmAction({ title, message, subMessage, confirmText, cancelText, icon, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'custom-confirm-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(44, 62, 80, 0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  
  // Define animations if not present
  if (!document.getElementById('modal-animations')) {
    const style = document.createElement('style');
    style.id = 'modal-animations';
    style.innerHTML = `
      @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes modalScaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
    document.head.appendChild(style);
  }

  overlay.style.animation = 'modalFadeIn 0.2s ease forwards';
  
  overlay.innerHTML = `
    <div class="custom-confirm-modal" style="background:var(--card,#fff);border:none;border-radius:var(--radius, 12px);width:90%;max-width:420px;padding:36px;text-align:center;box-shadow:var(--shadow-xl, 0 16px 48px rgba(0,0,0,0.16));animation:modalScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-light, rgba(243,156,18,0.1));display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
        <span class="material-symbols-outlined" style="font-size:32px;color:var(--accent,#F39C12);">${icon || 'warning'}</span>
      </div>
      <h3 style="margin:0 0 12px;font-size:22px;font-weight:700;color:var(--primary,#2C3E50);">${title || 'Confirm Action'}</h3>
      <p style="color:var(--text-secondary,#6c7a89);margin:0 0 8px;font-size:15px;">${message || 'Are you sure?'}</p>
      ${subMessage ? `<p style="color:var(--text,#2C3E50);margin:0 0 24px;font-size:16px;font-weight:600;">${subMessage}</p>` : ''}
      <div style="display:flex;gap:12px;margin-top:32px;justify-content:center;">
        <button data-action="cancel" class="btn btn-outline" style="min-width:110px;padding:12px;border-radius:var(--radius-sm, 8px);font-weight:600;">${cancelText || 'Cancel'}</button>
        <button data-action="confirm" class="btn btn-primary" style="min-width:140px;padding:12px;border-radius:var(--radius-sm, 8px);font-weight:700;">${confirmText || 'Delete'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const remove = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      if (overlay.parentNode) document.body.removeChild(overlay);
    }, 200);
  };

  overlay.querySelector('[data-action="cancel"]').addEventListener('click', (e) => {
    e.preventDefault();
    remove();
  });
  
  overlay.querySelector('[data-action="confirm"]').addEventListener('click', (e) => {
    e.preventDefault();
    onConfirm();
    remove();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) remove();
  });
}

export default function LegacyPageContent({ role, fileName }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const contentPath = useMemo(() => {
    const name = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
    return `/${role}/${name}`;
  }, [fileName, role]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadContent() {
      try {
        console.log(`[LegacyPageContent] Fetching content from: ${contentPath}`);
        const response = await fetch(contentPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const dashContent = doc.querySelector(".dash-content");
        if (!dashContent) {
          throw new Error("Dash content section missing (.dash-content not found in fetched HTML).");
        }

        // Strip script tags to prevent legacy JS from running and causing loops
        dashContent.querySelectorAll('script').forEach(s => s.remove());

        dashContent.querySelectorAll('a[href$=".html"]').forEach((anchor) => {
          const href = anchor.getAttribute("href");
          if (!href) return;
          if (href.startsWith("/")) {
            anchor.setAttribute("href", href.replace(".html", ""));
            return;
          }
          anchor.setAttribute("href", `/${role}/${href.replace(".html", "")}`);
        });

        if (isMounted) {
          const innerHTML = dashContent.innerHTML;
          setContent(innerHTML);
          // We'll trigger the initialization in another effect that watches 'content' and 'loading'
        }
      } catch (err) {
        console.error("[LegacyPageContent] Error loading content:", err);
        if (isMounted) {
          setContent(
            `<div class="panel"><div class="panel-body"><p style="color:var(--danger)">Error: ${err.message}</p><p>Unable to load page content for <strong>${fileName}</strong> from <code>${contentPath}</code>.</p></div></div>`,
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadContent();

    return () => {
      isMounted = false;
    };
  }, [contentPath, fileName, role]);

  useEffect(() => {
    if (loading || !contentRef.current) return;
    const handleInput = (e) => {
      const isTextInput = (e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'search')) || e.target.tagName === 'TEXTAREA';
      if (isTextInput) {
        const name = (e.target.name || e.target.id || '').toLowerCase();
        // Do NOT affect emails, passwords, or system-generated fields.
        if (name.includes('email') || name.includes('password') || e.target.readOnly || e.target.disabled) return;
        
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const newValue = e.target.value.replace(/\b\w/g, l => l.toUpperCase());
        if (e.target.value !== newValue) {
          e.target.value = newValue;
          e.target.setSelectionRange(start, end);
        }
      }
    };
    contentRef.current.addEventListener('input', handleInput);
    return () => contentRef.current?.removeEventListener('input', handleInput);
  }, [content, loading]);

  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  useEffect(() => {
    if (loading || !contentRef.current) {
      return undefined;
    }

    const cleanups = [];
    console.log(`[LegacyPageContent] Initializing ${fileName} for role ${role}, ID: ${id}`);

    // ── Admin pages ────────────────────────────────────────────────────────
    if (role === "admin" && (fileName === "index.html" || fileName === "index")) {
      cleanups.push(initAdminDashboard(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && (fileName === "analytics.html" || fileName === "analytics")) {
      cleanups.push(initAnalyticsPage(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && (fileName === "budget.html" || fileName === "budget")) {
      cleanups.push(initBudgetPage(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && (fileName === "attendance.html" || fileName === "attendance")) {
      cleanups.push(initAttendanceView(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && (fileName === "system-logs.html" || fileName === "system-logs")) {
      cleanups.push(initSystemLogsPage(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && fileName === "create-user.html") {
      cleanups.push(initCreateUserForm(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && fileName === "create-project.html") {
      cleanups.push(initCreateProject(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && fileName === "edit-project.html") {
      cleanups.push(initEditProject(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && fileName === "manage-users.html") {
      cleanups.push(initManageUsers(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && fileName === "project-list.html") {
      cleanups.push(initProjectList(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && (fileName === "expenses.html" || fileName === "expenses")) {
      cleanups.push(initExpenseList(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && (fileName === "photo-upload.html" || fileName === "photo-upload")) {
      cleanups.push(initPhotoUpload(contentRef.current, showToast, navigate));
    }
    if (role === "admin" && (fileName === "photo-gallery.html" || fileName === "photo-gallery")) {
      cleanups.push(initPhotoGallery(contentRef.current, showToast, navigate, role));
    }
    if ((role === "admin" || role === "pm" || role === "client") && (fileName === "gantt.html" || fileName === "gantt")) {
      cleanups.push(initGanttChart(contentRef.current, showToast, navigate));
    }

    // ── PM pages ───────────────────────────────────────────────────────────
    if (role === "pm" && (fileName === "index.html" || fileName === "index")) {
      cleanups.push(initPmDashboard(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && fileName === "create-phase.html") {
      cleanups.push(initCreatePhaseForm(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && fileName === "create-task.html") {
      cleanups.push(initCreateTaskForm(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && fileName === "manage-tasks.html") {
      cleanups.push(initManageTasks(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && fileName === "view-task.html") {
      cleanups.push(initViewTask(contentRef.current, showToast, navigate, id));
    }
    if ((role === "pm" || role === "admin") && fileName === "edit-task.html") {
      cleanups.push(initEditTask(contentRef.current, showToast, navigate, id));
    }
    if ((role === "pm" || role === "admin") && fileName === "manage-phases.html") {
      cleanups.push(initManagePhases(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && fileName === "view-phase.html") {
      cleanups.push(initViewPhase(contentRef.current, showToast, navigate, id));
    }
    if ((role === "pm" || role === "admin") && fileName === "edit-phase.html") {
      cleanups.push(initEditPhase(contentRef.current, showToast, navigate, id));
    }
    if (role === "pm" && (fileName === "analytics.html" || fileName === "analytics")) {
      cleanups.push(initAnalyticsPage(contentRef.current, showToast, navigate));
    }
    if (role === "pm" && (fileName === "budget-summary.html" || fileName === "budget-summary")) {
      cleanups.push(initBudgetPage(contentRef.current, showToast, navigate));
    }
    if (role === "pm" && fileName === "attendance.html") {
      cleanups.push(initAttendanceView(contentRef.current, showToast, navigate));
    }
    if (role === "pm" && (fileName === "expense-list.html" || fileName === "expense-list")) {
      cleanups.push(initExpenseList(contentRef.current, showToast, navigate));
    }
    if (role === "pm" && (fileName === "expense-entry.html" || fileName === "expense-entry")) {
      cleanups.push(initExpenseEntry(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && (fileName === "material-report.html" || fileName === "material-report")) {
      cleanups.push(initMaterialReport(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && (fileName === "material-stock.html" || fileName === "material-stock")) {
      cleanups.push(initMaterialStock(contentRef.current, showToast, navigate));
    }
    if ((role === "pm" || role === "admin") && (fileName === "material-master.html" || fileName === "material-master")) {
      cleanups.push(initMaterialMaster(contentRef.current, showToast, navigate));
    }
    if (role === "pm" && (fileName === "photo-gallery.html" || fileName === "photo-gallery")) {
      cleanups.push(initPhotoGallery(contentRef.current, showToast, navigate, role));
    }
    if (role === "pm" && (fileName === "photo-upload.html" || fileName === "photo-upload")) {
      cleanups.push(initPhotoUpload(contentRef.current, showToast, navigate));
    }

    // ── SE pages ───────────────────────────────────────────────────────────
    if (role === "se" && (fileName === "index.html" || fileName === "index")) {
      cleanups.push(initSeDashboard(contentRef.current, showToast, navigate));
    }
    if (role === "se" && fileName === "my-tasks.html") {
      cleanups.push(initSiteEngineerTaskBoard(contentRef.current, showToast, navigate));
    }
    if (role === "se" && (fileName === "material-usage.html" || fileName === "material-usage")) {
      cleanups.push(initMaterialUsage(contentRef.current, showToast, navigate));
    }
    if (role === "se" && (fileName === "check-in.html" || fileName === "check-in")) {
      cleanups.push(initCheckIn(contentRef.current, showToast, navigate));
    }
    if (role === "se" && (fileName === "attendance-history.html" || fileName === "attendance-history")) {
      cleanups.push(initAttendanceHistory(contentRef.current, showToast, navigate));
    }
    if (role === "se" && (fileName === "performance.html" || fileName === "performance")) {
      cleanups.push(initPerformance(contentRef.current, showToast, navigate));
    }

    // ── Client pages ───────────────────────────────────────────────────────
    if (role === "client" && (fileName === "index.html" || fileName === "index")) {
      cleanups.push(initClientDashboard(contentRef.current, showToast, navigate));
    }
    if (role === "client" && (fileName === "project-progress.html" || fileName === "project-progress")) {
      cleanups.push(initProjectProgress(contentRef.current, showToast, navigate));
    }
    if (role === "client" && (fileName === "phase-progress.html" || fileName === "phase-progress")) {
      cleanups.push(initPhaseProgress(contentRef.current, showToast, navigate));
    }
    if (role === "client" && (fileName === "photo-gallery.html" || fileName === "photo-gallery")) {
      cleanups.push(initPhotoGallery(contentRef.current, showToast, navigate, role));
    }
    if (role === "se" && (fileName === "gallery.html" || fileName === "gallery")) {
      cleanups.push(initPhotoGallery(contentRef.current, showToast, navigate, role));
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [content, fileName, loading, role, showToast, id]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const id = queryParams.get('id');

    if (!contentRef.current) return;
    const passwordInputs = contentRef.current.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
      if (input.parentElement.classList.contains('password-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'password-wrapper';
      wrapper.style.position = 'relative';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      input.style.paddingRight = '40px';
      
      const toggle = document.createElement('span');
      toggle.className = 'material-symbols-outlined';
      toggle.textContent = 'visibility';
      toggle.style.position = 'absolute';
      toggle.style.right = '10px';
      toggle.style.top = '50%';
      toggle.style.transform = 'translateY(-50%)';
      toggle.style.cursor = 'pointer';
      toggle.style.color = 'var(--text-muted)';
      toggle.style.zIndex = '10';
      
      toggle.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggle.textContent = 'visibility_off';
        } else {
          input.type = 'password';
          toggle.textContent = 'visibility';
        }
      });
      wrapper.appendChild(toggle);
    });
  }, [content]);


  const onClick = (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("/")) return;
    event.preventDefault();
    navigate(href);
  };

  if (loading) {
    return <div className="legacy-content-loading">Loading page content...</div>;
  }

  return <div ref={contentRef} onClick={onClick} dangerouslySetInnerHTML={{ __html: content }} />;
}

function initCreateUserForm(root, showToast, navigate) {
  const form = root.querySelector("[data-create-user-form]");
  if (!form) return undefined;

  const onSubmit = async (event) => {
    event.preventDefault();
    console.log('Submit Create User');
    
    const name = form.elements.name?.value.trim();
    const email = form.elements.email?.value.trim();
    const password = form.elements.password?.value.trim();
    const roleDisplay = form.elements.role?.value;
    const statusDisplay = form.elements.status?.value;

    if (!name || !email || !password || !roleDisplay) {
      showToast("Complete all required fields before saving.", "warning");
      return;
    }

    const roleApiMap = { 
      'Project Manager': 'project_manager', 
      'Site Engineer': 'site_engineer', 
      'Client': 'client', 
      'Admin': 'admin' 
    };
    const role = roleApiMap[roleDisplay] || roleDisplay.toLowerCase().replace(/ /g, '_');

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Creating...';
    btn.disabled = true;

    try {
      console.log('Sending user payload:', { full_name: name, email, role });
      const newUser = await apiFetch('/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: name,
          email: email,
          password: password,
          role: role,
          is_active: statusDisplay === 'Active'
        })
      }, navigate);
      console.log('User created:', newUser);
      showToast(`User ${name} created successfully!`, "success");
      form.reset();
      if (form.elements.status) form.elements.status.value = "Active";
    } catch (err) {
      console.error('User creation failed:', err);
      showToast(err.message || 'Failed to create user', 'danger');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}

function initEngineerPicker(root, showToast, navigate) {
  const picker = root.querySelector("[data-engineer-picker]");
  const form = root.querySelector("[data-project-form]");
  if (!picker || !form) return undefined;

  const pmSelect = root.querySelector('#projectManager');
  const clientSelect = root.querySelector('#projectClient');
  const seDropdown = root.querySelector('[data-engineer-options]');
  let checkboxes = Array.from(picker.querySelectorAll('input[type="checkbox"]'));

  Promise.all([
    apiFetch('/v1/users', {}, navigate),
    apiFetch('/v1/users?role=site_engineer&status=active', {}, navigate)
  ]).then(([users, activeEngineers]) => {
    console.log('Loaded users for project assignment:', users);
    if (!users || !Array.isArray(users)) {
      console.error('Expected array of users, got:', users);
      showToast("API returned invalid user list. Check console.", "danger");
      return;
    }
    const pms = users.filter(u => u.role === 'project_manager');
    const clients = users.filter(u => u.role === 'client');
    const engineers = activeEngineers || [];
    console.log('Filtered Users:', { pms: pms.length, clients: clients.length, engineers: engineers.length });

    if (pmSelect) {
      pmSelect.innerHTML = '<option value="">Select project manager</option>';
      pms.forEach(pm => {
        const opt = document.createElement('option');
        opt.value = pm.id;
        opt.textContent = pm.full_name;
        pmSelect.appendChild(opt);
      });
      if (pms.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = "No project managers found";
        opt.disabled = true;
        pmSelect.appendChild(opt);
      }
    }

    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">Select client</option>';
      clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.full_name;
        clientSelect.appendChild(opt);
      });
      if (clients.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = "No clients found";
        opt.disabled = true;
        clientSelect.appendChild(opt);
      }
    }

    if (seDropdown) {
      seDropdown.innerHTML = '';
      if (engineers.length === 0) {
        seDropdown.innerHTML = '<div style="padding:10px;color:var(--text-muted)">No engineers found.</div>';
      }
      engineers.forEach(se => {
        const label = document.createElement('label');
        label.className = 'engineer-option';
        label.innerHTML = `
          <input type="checkbox" value="${se.id}" data-name="${se.full_name}">
          <span><strong>${se.full_name}</strong><small>${se.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</small></span>
        `;
        seDropdown.appendChild(label);
      });
      checkboxes = Array.from(picker.querySelectorAll('input[type="checkbox"]'));
      checkboxes.forEach((checkbox) => checkbox.addEventListener("change", onCheckboxChange));
      render();
      filterOptions();
    }
  }).catch(err => {
    console.error("Failed to load users:", err);
    showToast("Failed to load users for assignment: " + err.message, "danger");
  });

  const tags = picker.querySelector("[data-engineer-tags]");
  const search = picker.querySelector("[data-engineer-search]");
  const clearButton = picker.querySelector("[data-clear-engineers]");
  const summary = picker.querySelector("[data-selection-count]");
  const nativeSelect = picker.querySelector("[data-native-engineers]");
  const resetButton = root.querySelector("[data-project-reset]");

  const render = () => {
    const selected = checkboxes.filter((checkbox) => checkbox.checked);
    tags.innerHTML = "";

    if (!selected.length) {
      tags.innerHTML = '<span class="engineer-picker-placeholder">No site engineers selected yet.</span>';
    } else {
      selected.forEach((checkbox) => {
        const chip = document.createElement("span");
        chip.className = "engineer-tag";
        chip.innerHTML = `<span>${checkbox.dataset.name || checkbox.value}</span><button type="button" aria-label="Remove">×</button>`;
        chip.querySelector("button").addEventListener("click", () => {
          checkbox.checked = false;
          render();
        });
        tags.appendChild(chip);
      });
    }

    checkboxes.forEach((checkbox) => {
      checkbox.closest(".engineer-option")?.classList.toggle("is-selected", checkbox.checked);
    });

    Array.from(nativeSelect.options).forEach((option) => {
      option.selected = selected.some((checkbox) => checkbox.value === option.value);
    });

    summary.textContent = `${selected.length} engineer${selected.length === 1 ? "" : "s"} selected`;
  };

  const filterOptions = () => {
    const query = search.value.trim().toLowerCase();
    checkboxes.forEach((checkbox) => {
      const option = checkbox.closest(".engineer-option");
      const matches = !query || option?.textContent?.toLowerCase().includes(query);
      option?.classList.toggle("is-hidden", !matches);
    });
  };

  const onCheckboxChange = () => render();
  const onSearch = () => filterOptions();
  const onClear = () => {
    search.value = "";
    checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    filterOptions();
    render();
  };
  const onReset = () => window.setTimeout(() => onClear(), 0);

  const onSubmit = async (event) => {
    event.preventDefault();
    const name = root.querySelector('#projectName').value.trim();
    if (!name) { showToast('Project Name is required', 'warning'); return; }

    const pmId = root.querySelector('#projectManager').value;
    if (!pmId) { showToast('Project Manager is required', 'warning'); return; }

    const clientId = root.querySelector('#projectClient').value;
    const selectedCheckboxes = checkboxes.filter((checkbox) => checkbox.checked);

    const btn = form.querySelector('[data-create-project-submit]');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Creating...';
    btn.disabled = true;

    try {
      const startDate = root.querySelector('#projectStartDate').value || null;
      const endDate = root.querySelector('#projectEndDate').value || null;
      const budgetStr = root.querySelector('#projectBudget').value.replace(/,/g, '');
      const budget = budgetStr ? parseFloat(budgetStr) : null;
      const description = root.querySelector('#projectDescription').value.trim();
      const location = root.querySelector('#projectLocation')?.value.trim() || null;

      const payload = {
        name,
        description: description || null,
        location: location || null,
        status: 'planning',
        start_date: startDate,
        end_date: endDate,
        budget,
        manager_id: pmId
      };

      const project = await apiFetch('/v1/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, navigate);

      const assignments = [];
      if (clientId) assignments.push({ user_id: clientId, role: 'client' });
      selectedCheckboxes.forEach(cb => assignments.push({ user_id: cb.value, role: 'site_engineer' }));

      if (assignments.length > 0) {
        await Promise.all(assignments.map(assignment =>
          apiFetch(`/v1/projects/${project.id}/assignments`, {
            method: 'POST',
            body: JSON.stringify(assignment)
          }, navigate)
        ));
      }

      showToast('Project created and team assigned successfully!', 'success');
      setTimeout(() => navigate('/admin/project-list.html'), 1500);
    } catch (err) {
      showToast('Error: ' + err.message, 'danger');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  checkboxes.forEach((checkbox) => checkbox.addEventListener("change", onCheckboxChange));
  search.addEventListener("input", onSearch);
  clearButton.addEventListener("click", onClear);
  resetButton?.addEventListener("click", onReset);
  form.addEventListener("submit", onSubmit);

  render();
  filterOptions();

  return () => {
    checkboxes.forEach((checkbox) => checkbox.removeEventListener("change", onCheckboxChange));
    search.removeEventListener("input", onSearch);
    clearButton.removeEventListener("click", onClear);
    resetButton?.removeEventListener("click", onReset);
    form.removeEventListener("submit", onSubmit);
  };
}

function initEditProject(root, showToast, navigate) {
  const picker = root.querySelector("[data-engineer-picker]");
  const form = root.querySelector("[data-project-form]");
  if (!picker || !form) return undefined;

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('edit');
  if (!projectId) {
    showToast("No project ID provided for editing.", "danger");
    navigate('/admin/project-list.html');
    return undefined;
  }

  const pmSelect = root.querySelector('#projectManager');
  const clientSelect = root.querySelector('#projectClient');
  const seDropdown = root.querySelector('[data-engineer-options]');
  let checkboxes = Array.from(picker.querySelectorAll('input[type="checkbox"]'));

  let initialProjectData = null;

  Promise.all([
    apiFetch('/v1/users', {}, navigate),
    apiFetch('/v1/users?role=site_engineer&status=active', {}, navigate),
    apiFetch(`/v1/projects/${projectId}`, {}, navigate)
  ]).then(([users, activeEngineers, projectData]) => {
    initialProjectData = projectData;
    const pms = users.filter(u => u.role === 'project_manager');
    const clients = users.filter(u => u.role === 'client');
    const engineers = activeEngineers || [];

    if (pmSelect) {
      pmSelect.innerHTML = '<option value="">Select project manager</option>';
      pms.forEach(pm => {
        const opt = document.createElement('option');
        opt.value = pm.id;
        opt.textContent = pm.full_name;
        pmSelect.appendChild(opt);
      });
      if (projectData.manager_id) {
        const pmId = String(projectData.manager_id).toLowerCase();
        const found = Array.from(pmSelect.options).find(opt => opt.value.toLowerCase() === pmId);
        if (found) pmSelect.value = found.value;
      }
    }

    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">Select client</option>';
      clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.full_name;
        clientSelect.appendChild(opt);
      });
      if (projectData.assignments) {
        const clientAssignment = projectData.assignments.find(a => a.role === 'client');
        if (clientAssignment) {
          const cid = String(clientAssignment.user_id).toLowerCase();
          const found = Array.from(clientSelect.options).find(opt => opt.value.toLowerCase() === cid);
          if (found) clientSelect.value = found.value;
        }
      }
    }

    if (seDropdown) {
      seDropdown.innerHTML = '';
      if (engineers.length === 0) {
        seDropdown.innerHTML = '<div style="padding:10px;color:var(--text-muted)">No engineers found.</div>';
      }
      engineers.forEach(se => {
        const label = document.createElement('label');
        label.className = 'engineer-option';
        
        let isChecked = '';
        if (projectData.assignments) {
           const seId = String(se.id).toLowerCase();
           const isAssigned = projectData.assignments.some(a => 
             a.role === 'site_engineer' && String(a.user_id).toLowerCase() === seId
           );
           if (isAssigned) isChecked = 'checked';
        }
        
        label.innerHTML = `
          <input type="checkbox" value="${se.id}" data-name="${se.full_name}" ${isChecked}>
          <span><strong>${se.full_name}</strong><small>${se.role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</small></span>
        `;
        seDropdown.appendChild(label);
      });
      checkboxes = Array.from(picker.querySelectorAll('input[type="checkbox"]'));
      checkboxes.forEach((checkbox) => checkbox.addEventListener("change", onCheckboxChange));
    }
    
    // Fill other fields
    if (root.querySelector('#projectName')) root.querySelector('#projectName').value = projectData.name || '';
    if (root.querySelector('#projectLocation')) root.querySelector('#projectLocation').value = projectData.location || '';
    if (root.querySelector('#projectStartDate') && projectData.start_date) root.querySelector('#projectStartDate').value = projectData.start_date;
    if (root.querySelector('#projectEndDate') && projectData.end_date) root.querySelector('#projectEndDate').value = projectData.end_date;
    if (root.querySelector('#projectBudget') && projectData.budget) root.querySelector('#projectBudget').value = projectData.budget;
    if (root.querySelector('#projectDescription')) root.querySelector('#projectDescription').value = projectData.description || '';
    
    render();
    filterOptions();
  }).catch(err => {
    console.error("Failed to load project details:", err);
    showToast("Failed to load project details: " + err.message, "danger");
  });

  const tags = picker.querySelector("[data-engineer-tags]");
  const search = picker.querySelector("[data-engineer-search]");
  const clearButton = picker.querySelector("[data-clear-engineers]");
  const summary = picker.querySelector("[data-selection-count]");
  const nativeSelect = picker.querySelector("[data-native-engineers]");

  const render = () => {
    const selected = checkboxes.filter((checkbox) => checkbox.checked);
    tags.innerHTML = "";

    if (!selected.length) {
      tags.innerHTML = '<span class="engineer-picker-placeholder">No site engineers selected yet.</span>';
    } else {
      selected.forEach((checkbox) => {
        const chip = document.createElement("span");
        chip.className = "engineer-tag";
        chip.innerHTML = `<span>${checkbox.dataset.name || checkbox.value}</span><button type="button" aria-label="Remove">×</button>`;
        chip.querySelector("button").addEventListener("click", () => {
          checkbox.checked = false;
          render();
        });
        tags.appendChild(chip);
      });
    }

    checkboxes.forEach((checkbox) => {
      checkbox.closest(".engineer-option")?.classList.toggle("is-selected", checkbox.checked);
    });

    if (nativeSelect) {
      Array.from(nativeSelect.options).forEach((option) => {
        option.selected = selected.some((checkbox) => checkbox.value === option.value);
      });
    }

    summary.textContent = `${selected.length} engineer${selected.length === 1 ? "" : "s"} selected`;
  };

  const filterOptions = () => {
    const query = search.value.trim().toLowerCase();
    checkboxes.forEach((checkbox) => {
      const option = checkbox.closest(".engineer-option");
      const matches = !query || option?.textContent?.toLowerCase().includes(query);
      option?.classList.toggle("is-hidden", !matches);
    });
  };

  const onCheckboxChange = () => render();
  const onSearch = () => filterOptions();
  const onClear = () => {
    search.value = "";
    checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    filterOptions();
    render();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const name = root.querySelector('#projectName').value.trim();
    if (!name) { showToast('Project Name is required', 'warning'); return; }

    const pmId = root.querySelector('#projectManager').value;
    if (!pmId) { showToast('Project Manager is required', 'warning'); return; }

    const clientId = root.querySelector('#projectClient').value;
    const selectedCheckboxes = checkboxes.filter((checkbox) => checkbox.checked);

    const btn = form.querySelector('[data-edit-project-submit]');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Saving...';
    btn.disabled = true;

    try {
      const startDate = root.querySelector('#projectStartDate').value || null;
      const endDate = root.querySelector('#projectEndDate').value || null;
      const budgetStr = root.querySelector('#projectBudget').value.replace(/,/g, '');
      const budget = budgetStr ? parseFloat(budgetStr) : null;
      const description = root.querySelector('#projectDescription').value.trim();
      const location = root.querySelector('#projectLocation')?.value.trim() || null;

      const payload = {
        name,
        description: description || null,
        location: location || null,
        status: initialProjectData?.status || 'planning',
        start_date: startDate,
        end_date: endDate,
        budget,
        manager_id: pmId
      };

      await apiFetch(`/v1/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }, navigate);

      const assignments = [];
      if (clientId) assignments.push({ user_id: clientId, role: 'client' });
      selectedCheckboxes.forEach(cb => assignments.push({ user_id: cb.value, role: 'site_engineer' }));

      // Remove existing assignments (or we can just POST and the backend handles conflicts, assuming we have a way to set assignments)
      // Since there's no endpoint to replace all assignments easily without checking schema, let's just make POST requests and ignore 409s.
      // Wait, if an engineer is removed, how do we unassign them? The API has DELETE /v1/projects/{project_id}/assignments/{assignment_id}.
      // We should probably just clear all old and set new, or just leave it for now.
      if (assignments.length > 0) {
        await Promise.allSettled(assignments.map(assignment =>
          apiFetch(`/v1/projects/${projectId}/assignments`, {
            method: 'POST',
            body: JSON.stringify(assignment)
          }, navigate)
        ));
      }

      showToast('Project updated successfully!', 'success');
      setTimeout(() => navigate('/admin/project-list.html'), 1500);
    } catch (err) {
      showToast('Error: ' + err.message, 'danger');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  search.addEventListener("input", onSearch);
  clearButton.addEventListener("click", onClear);
  form.addEventListener("submit", onSubmit);

  const deleteBtn = root.querySelector('[data-project-delete]');
  const deleteModal = root.querySelector('#deleteProjectModal');
  const confirmDeleteBtn = root.querySelector('#confirmDeleteProject');
  const cancelDeleteBtn = root.querySelector('#cancelDeleteProject');
  const deleteNameDisplay = root.querySelector('#deleteProjectNameDisplay');

  const showDeleteModal = () => {
    if (deleteModal) {
      if (deleteNameDisplay) {
        deleteNameDisplay.textContent = `You are about to delete "${name || 'this project'}".`;
      }
      deleteModal.style.display = 'flex';
    }
  };

  const hideDeleteModal = () => {
    if (deleteModal) {
      deleteModal.style.display = 'none';
    }
  };

  const performDelete = async () => {
    const originalText = confirmDeleteBtn.innerHTML;
    confirmDeleteBtn.innerHTML = 'Deleting...';
    confirmDeleteBtn.disabled = true;

    try {
      await apiFetch(`/v1/projects/${projectId}`, { method: 'DELETE' }, navigate);
      hideDeleteModal();
      showToast('Project deleted successfully.', 'success');
      setTimeout(() => navigate('/admin/project-list.html'), 1500);
    } catch (err) {
      showToast('Error deleting project: ' + err.message, 'danger');
      confirmDeleteBtn.innerHTML = originalText;
      confirmDeleteBtn.disabled = false;
      hideDeleteModal();
    }
  };

  if (deleteBtn) {
    deleteBtn.addEventListener("click", showDeleteModal);
  }
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", performDelete);
  }
  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) hideDeleteModal();
    });
  }

  return () => {
    checkboxes.forEach((checkbox) => checkbox.removeEventListener("change", onCheckboxChange));
    search.removeEventListener("input", onSearch);
    clearButton.removeEventListener("click", onClear);
    form.removeEventListener("submit", onSubmit);
    if (deleteBtn) deleteBtn.removeEventListener("click", showDeleteModal);
    if (cancelDeleteBtn) cancelDeleteBtn.removeEventListener("click", hideDeleteModal);
    if (confirmDeleteBtn) confirmDeleteBtn.removeEventListener("click", performDelete);
  };
}

function initGanttChart(root, showToast, navigate) {
  const projectSelect = root.querySelector('#ganttProjectSelect');
  const ganttContainer = root.querySelector('#ganttContainer');
  if (!projectSelect || !ganttContainer) return undefined;

  const DAY_PX = 28;

  const renderGantt = async (projectId) => {
    if (!projectId) {
      ganttContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Select a project to view Gantt Chart</div>';
      return;
    }
    ganttContainer.innerHTML = '<div style="text-align:center;padding:40px;"><span class="spinner"></span> Loading timeline…</div>';

    try {
      const [data, phasesRaw] = await Promise.all([
        apiFetch(`/v1/analytics/gantt?project_id=${projectId}`, {}, navigate),
        apiFetch(`/v1/phases/project/${projectId}`, {}, navigate).catch(() => [])
      ]);
      const tasks = (data && data.tasks) ? data.tasks : [];

      if (tasks.length === 0 && phasesRaw.length === 0) {
        ganttContainer.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">No phases or tasks found for this project.</div>';
        return;
      }

      const now = new Date(); now.setHours(0,0,0,0);
      let minTs = now.getTime();
      let maxTs = now.getTime() + 86400000 * 30;

      phasesRaw.forEach(ph => {
        if (ph.start_date) minTs = Math.min(minTs, new Date(ph.start_date).getTime());
        if (ph.end_date)   maxTs = Math.max(maxTs, new Date(ph.end_date).getTime());
      });
      tasks.forEach(t => {
        if (t.start_date) minTs = Math.min(minTs, new Date(t.start_date).getTime());
        if (t.due_date)   maxTs = Math.max(maxTs, new Date(t.due_date).getTime());
      });

      const startDate = new Date(minTs); startDate.setDate(startDate.getDate() - 2); startDate.setHours(0,0,0,0);
      const endDate   = new Date(maxTs); endDate.setDate(endDate.getDate() + 7); endDate.setHours(23,59,59,999);
      const totalDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
      const timelineW = totalDays * DAY_PX;

      const toX = (dateStr) => {
        if (!dateStr) return 0;
        const d = new Date(dateStr); d.setHours(0,0,0,0);
        return Math.max(0, Math.round((d - startDate) / 86400000) * DAY_PX);
      };
      const toW = (s, e) => {
        if (!s || !e) return DAY_PX;
        const start = new Date(s); start.setHours(0,0,0,0);
        const end = new Date(e); end.setHours(0,0,0,0);
        const diffDays = Math.round((end - start) / 86400000);
        return Math.max(DAY_PX, (diffDays + 1) * DAY_PX);
      };

      const COLORS = {
        completed:   '#27ae60',
        in_progress: '#3498db',
        not_started: '#bdc3c7',
        delayed:     '#e74c3c',
        blocked:     '#f39c12'
      };

      let rulerHtml = '';
      for (let d = 0; d < totalDays; d++) {
        const tick = new Date(startDate.getTime() + d * 86400000);
        const isMonday = tick.getDay() === 1;
        const isFirst = d === 0;
        
        rulerHtml += `<div style="position:absolute;left:${d*DAY_PX}px;top:0;bottom:0;display:flex;flex-direction:column;align-items:flex-start;">`;
        if (isMonday || isFirst) {
          const label = tick.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
          rulerHtml += `<span style="font-size:10px;color:var(--text-muted);white-space:nowrap;padding-left:3px;padding-top:4px;">${label}</span>`;
        } else {
          rulerHtml += `<span style="font-size:9px;color:var(--text-muted);opacity:0.5;white-space:nowrap;padding-left:3px;padding-top:4px;">${tick.getDate()}</span>`;
        }
        rulerHtml += `<div style="width:1px;flex:1;background:var(--border-color,#e0e0e0);opacity:${isMonday ? '0.6' : '0.2'};"></div>
        </div>`;
      }

      const d = now;
      const localStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const todayX = toX(localStr);
      rulerHtml += `<div style="position:absolute;left:${todayX}px;top:0;bottom:0;width:2px;background:var(--danger,#e74c3c);opacity:0.6;z-index:2;" title="Today"></div>`;

      const grouped = {};
      tasks.forEach(t => {
        const ph = t.phase_name || 'Unassigned';
        if (!grouped[ph]) grouped[ph] = { phase: phasesRaw.find(p => p.name === t.phase_name), tasks: [] };
        grouped[ph].tasks.push(t);
      });
      phasesRaw.forEach(ph => {
        if (!grouped[ph.name]) grouped[ph.name] = { phase: ph, tasks: [] };
      });

      const LABEL_W = 200;
      let rowsHtml = '';

      Object.keys(grouped).sort().forEach(phName => {
        const { phase, tasks: pTasks } = grouped[phName];
        const phStart = phase && phase.start_date;
        const phEnd   = phase && phase.end_date;
        const phColor = phase && phase.status === 'completed' ? COLORS.completed : phase && phase.status === 'in_progress' ? COLORS.in_progress : '#8e9db3';
        const phX = phStart ? toX(phStart) : 0;
        const phW = phStart && phEnd ? toW(phStart, phEnd) : DAY_PX * 5;
        const phTitle = phase ? `${phName} | ${formatDate(phStart)} to ${formatDate(phEnd)} | ${phase.status}` : phName;

        rowsHtml += `
          <div style="display:flex;align-items:center;background:#f9f9f9;border-bottom:1px solid var(--border-color,#e0e0e0);">
            <div style="position:sticky;left:0;z-index:5;background:#f9f9f9;min-width:${LABEL_W}px;max-width:${LABEL_W}px;padding:10px 12px;font-weight:700;font-size:12px;text-transform:uppercase;color:var(--text);border-right:1px solid var(--border-color,#e0e0e0);">${phName}</div>
            <div style="position:relative;height:40px;flex:1;min-width:${timelineW}px;">
              <div style="position:absolute;left:${phX}px;width:${phW}px;height:12px;top:14px;background:${phColor};opacity:0.35;border-radius:2px;" title="${phTitle}"></div>
            </div>
          </div>`;

        pTasks.forEach(t => {
          const tX = t.start_date ? toX(t.start_date) : (phStart ? toX(phStart) : 0);
          const tW = toW(t.start_date || phStart, t.due_date || phEnd);
          let color = COLORS.not_started;
          if (t.is_delayed) color = COLORS.delayed;
          else if (t.status) color = COLORS[t.status.toLowerCase()] || COLORS.not_started;
          const tTitle = `${t.name} | ${formatDate(t.start_date)} to ${formatDate(t.due_date)} | ${t.status}${t.is_delayed?' (Delayed)':''}`;

          rowsHtml += `
            <div style="display:flex;align-items:center;background:#fff;border-bottom:1px solid var(--border-color,#f0f0f0);">
              <div style="position:sticky;left:0;z-index:5;background:#fff;min-width:${LABEL_W}px;max-width:${LABEL_W}px;padding:8px 12px 8px 24px;font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-right:1px solid var(--border-color,#f0f0f0);" title="${tTitle}">↳ ${t.name}</div>
              <div style="position:relative;height:34px;flex:1;min-width:${timelineW}px;">
                <div style="position:absolute;left:${tX}px;width:${tW}px;height:10px;top:12px;background:${color};border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,0.1);"
                  title="${tTitle}"></div>
              </div>
            </div>`;
        });
      });

      ganttContainer.style.maxWidth = '100%';
      ganttContainer.style.overflowX = 'hidden';
      ganttContainer.innerHTML = `
        <div style="width:100%; max-width:100%; overflow-x:auto; overflow-y:auto; max-height:700px; border:1px solid var(--border-color,#e0e0e0); border-radius:8px; background:white; position:relative;">
          <div style="min-width:max-content;">
            <div style="display:flex; align-items:center; background:#fcfcfc; border-bottom:2px solid var(--border-color,#e0e0e0); position:sticky; top:0; z-index:10;">
              <div style="position:sticky;left:0;z-index:11;background:#fcfcfc;min-width:${LABEL_W}px;padding:12px;font-weight:600;font-size:11px;color:var(--text-muted);text-transform:uppercase;border-right:1px solid var(--border-color,#e0e0e0);">Phase / Task</div>
              <div style="position:relative;height:40px;flex:1;min-width:${timelineW}px;">${rulerHtml}</div>
            </div>
            ${rowsHtml}
          </div>
        </div>`;

    } catch (err) {
      ganttContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">Error: ${err.message}</div>`;
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
    projectSelect.addEventListener('change', () => renderGantt(projectSelect.value));
    if (projects.length === 1) { projectSelect.value = projects[0].id; renderGantt(projects[0].id); }
  });

  return undefined;
}

function initManageUsers(root, showToast, navigate) {
  const tbody = root.querySelector("[data-user-table-body]");
  const searchInput = root.querySelector("[data-user-search]");
  const filterButtons = Array.from(root.querySelectorAll("[data-role-filter]"));
  const emptyState = root.querySelector("[data-empty-state]");
  const modal = root.querySelector("[data-user-modal]");
  const editForm = root.querySelector("[data-user-edit-form]");
  const totalEl = root.querySelector("[data-user-total]");
  const activeEl = root.querySelector("[data-active-total]");
  const inactiveEl = root.querySelector("[data-inactive-total]");
  const deleteButton = root.querySelector("[data-delete-user]");
  const statusFilterSelect = root.querySelector("[data-status-filter]");

  if (!tbody || !searchInput || !modal || !editForm) {
    return undefined;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");
  document.documentElement.classList.remove("modal-open");

  let activeRole = "all";
  let editingId = null;
  let users = [];

  const roleToDisplay = (role) => {
    const map = { project_manager: 'Project Manager', site_engineer: 'Site Engineer', client: 'Client', admin: 'Admin' };
    return map[role] || role;
  };
  const roleApiMap = { 'Project Manager': 'project_manager', 'Site Engineer': 'site_engineer', 'Client': 'client', 'Admin': 'admin' };

  const updateCounts = () => {
    const active = users.filter(u => u.is_active).length;
    if (totalEl) totalEl.textContent = String(users.length);
    if (activeEl) activeEl.textContent = String(active);
    if (inactiveEl) inactiveEl.textContent = String(users.length - active);
  };

  const renderTable = (list) => {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">No users match this filter.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(u => {
      const rd = roleToDisplay(u.role);
      const statusClass = u.is_active ? 'active' : 'pending';
      const statusText = u.is_active ? 'Active' : 'Inactive';
      return `<tr data-user-row data-id="${u.id}">
        <td><strong>${u.full_name}</strong></td>
        <td>${u.email}</td>
        <td>${rd}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td class="manage-users-actions">
          <button type="button" class="table-action-btn" data-user-action="edit">Edit</button>
        </td>
      </tr>`;
    }).join('');
  };

  const applyFilters = () => {
    const query = searchInput.value.trim().toLowerCase();
    const activeStatus = statusFilterSelect ? statusFilterSelect.value : 'all';
    
    const filtered = users.filter(u => {
      const rd = roleToDisplay(u.role).toLowerCase();
      const roleMap = {
        'all': 'all',
        'project_manager': 'project manager',
        'site_engineer': 'site engineer',
        'client': 'client'
      };
      const targetRole = roleMap[activeRole] || activeRole.toLowerCase();
      const matchesRole = targetRole === 'all' || rd === targetRole;
      const matchesSrch = !query || u.full_name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || rd.includes(query);
      
      let matchesStatus = true;
      if (activeStatus === 'active') matchesStatus = u.is_active;
      if (activeStatus === 'inactive') matchesStatus = !u.is_active;
      
      return matchesRole && matchesSrch && matchesStatus;
    });
    renderTable(filtered);
    if (emptyState) emptyState.hidden = filtered.length > 0;
    updateCounts();
  };

  apiFetch('/v1/users', {}, navigate).then(data => {
    users = (data || []).filter(u => u.role !== 'admin');
    applyFilters();
  }).catch(err => {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;padding:20px">Error loading users: ${err.message}</td></tr>`;
  });

  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', applyFilters);
  }

  const openModal = (id) => {
    editingId = id;
    const u = users.find(x => String(x.id) === String(id));
    if (!u) return;
    
    editForm.elements.name.value = u.full_name || '';
    editForm.elements.email.value = u.email || '';
    editForm.elements.password.value = "";
    
    const rd = roleToDisplay(u.role);
    Array.from(editForm.elements.role.options).forEach(o => o.selected = o.value === rd);
    Array.from(editForm.elements.status.options).forEach(o => o.selected = o.value === (u.is_active ? 'Active' : 'Inactive'));
    
    editForm.elements.email.disabled = true;
    editForm.elements.role.disabled = true;

    let msgEl = editForm.querySelector('.freeze-msg');
    if (!msgEl) {
      msgEl = document.createElement('div');
      msgEl.className = 'freeze-msg';
      msgEl.style.color = 'var(--text-muted)';
      msgEl.style.fontSize = '12px';
      msgEl.style.marginBottom = '15px';
      msgEl.textContent = 'Main role and email cannot be modified';
      editForm.insertBefore(msgEl, editForm.firstChild);
    }

    modal.hidden = false;
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");
    editingId = null;
  };

  // ── Delete user: custom confirmation modal + API call ──
  const doDeleteUser = () => {
    if (!editingId) return;
    const u = users.find(x => String(x.id) === String(editingId));
    const userName = u ? u.full_name : 'this user';

    confirmAction({
      title: 'Delete User?',
      message: `You are about to delete`,
      subMessage: `"${userName}"`,
      confirmText: 'Yes, Delete User',
      icon: 'person_remove',
      onConfirm: async () => {
        try {
          await apiFetch(`/v1/users/${editingId}`, { method: 'DELETE' }, navigate);
          users = users.filter(u => String(u.id) !== String(editingId));
          applyFilters();
          closeModal();
          showToast("User deleted successfully.", "success");
        } catch (err) {
          showToast('Failed to delete: ' + err.message, 'danger');
        }
      }
    });
  };

  const onSearch = () => applyFilters();
  const onFilterClick = (event) => {
    const button = event.currentTarget;
    activeRole = button.dataset.roleFilter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    applyFilters();
  };

  const onTableClick = (event) => {
    const button = event.target.closest("[data-user-action]");
    if (!button) return;

    const row = button.closest("[data-user-row]");
    const action = button.dataset.userAction;

    if (action === "edit") {
      openModal(row.dataset.id);
    }
  };

  const onModalClick = (event) => {
    if (event.target.closest("[data-delete-user]")) return;
    if (event.target === modal || event.target.closest("[data-close-user-modal]")) {
      closeModal();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  };

  const onSave = async (event) => {
    event.preventDefault();
    if (!editingId) return;

    const payload = {
      full_name: editForm.elements.name.value.trim(),
      is_active: editForm.elements.status.value === 'Active'
    };
    const pw = editForm.elements.password.value;
    if (pw) payload.password = pw;

    const saveBtn = editForm.querySelector('[type="submit"]');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      const updated = await apiFetch(`/v1/users/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }, navigate);
      const idx = users.findIndex(u => String(u.id) === String(editingId));
      if (idx !== -1) users[idx] = updated;
      applyFilters();
      closeModal();
      showToast("User details updated successfully.", "success");
    } catch (err) {
      showToast('Failed to update: ' + err.message, 'danger');
    } finally {
      saveBtn.textContent = 'Save Changes';
      saveBtn.disabled = false;
    }
  };

  searchInput.addEventListener("input", onSearch);
  filterButtons.forEach((button) => button.addEventListener("click", onFilterClick));
  root.addEventListener("click", onTableClick);
  modal.addEventListener("click", onModalClick);
  editForm.addEventListener("submit", onSave);
  deleteButton?.addEventListener("click", doDeleteUser);
  document.addEventListener("keydown", onKeyDown);

  return () => {
    searchInput.removeEventListener("input", onSearch);
    filterButtons.forEach((button) => button.removeEventListener("click", onFilterClick));
    root.removeEventListener("click", onTableClick);
    modal.removeEventListener("click", onModalClick);
    editForm.removeEventListener("submit", onSave);
    deleteButton?.removeEventListener("click", doDeleteUser);
    document.removeEventListener("keydown", onKeyDown);
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");
  };
}

function initCreatePhaseForm(root, showToast, navigate) {
  const form = root.querySelector('#createPhaseForm') || root.querySelector('[data-create-phase-form]');
  if (!form) return undefined;

  const projectSelect = form.querySelector('#phaseProject') || form.querySelector('#phaseProjectSelect');
  const startDateInput = root.querySelector('#phaseStartDate');
  const endDateInput = root.querySelector('#phaseEndDate');
  
  // Add context display
  let contextDiv = form.querySelector('.project-context');
  if (!contextDiv && projectSelect) {
    contextDiv = document.createElement('div');
    contextDiv.className = 'project-context';
    contextDiv.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-top: -12px; margin-bottom: 12px; padding: 4px 0;';
    projectSelect.parentNode.insertBefore(contextDiv, projectSelect.nextSibling);
  }

  let projectsData = [];

  const updateDateConstraints = () => {
    const pid = projectSelect.value;
    const project = projectsData.find(p => String(p.id) === String(pid));
    
    if (project && contextDiv) {
      const startStr = project.start_date ? formatDate(project.start_date) : 'N/A';
      const endStr = project.end_date ? formatDate(project.end_date) : 'N/A';
      contextDiv.innerHTML = `<strong>Project:</strong> ${project.name} (${startStr} to ${endStr})`;
      
      if (startDateInput) {
        startDateInput.min = project.start_date || '';
        startDateInput.max = project.end_date || '';
      }
      if (endDateInput) {
        endDateInput.min = project.start_date || '';
        endDateInput.max = project.end_date || '';
      }
    } else if (contextDiv) {
      contextDiv.innerHTML = '';
      if (startDateInput) { startDateInput.min = ''; startDateInput.max = ''; }
      if (endDateInput) { endDateInput.min = ''; endDateInput.max = ''; }
    }
  };

  if (projectSelect) {
    apiFetch('/v1/projects', {}, navigate).then(projects => {
      if (!projects || !Array.isArray(projects)) return;
      projectsData = projects;
      projectSelect.innerHTML = '<option value="">Select project</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        projectSelect.appendChild(opt);
      });
      projectSelect.addEventListener('change', updateDateConstraints);
    }).catch(err => console.error('Failed to load projects:', err));
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    const pid = projectSelect.value;
    const project = projectsData.find(p => String(p.id) === String(pid));

    const payload = {
      project_id: pid,
      name: form.querySelector('input[type="text"]').value.trim(),
      description: form.querySelector('textarea')?.value.trim() || null,
      start_date: startDateInput?.value || null,
      end_date: endDateInput?.value || null
    };

    if (!payload.name || !payload.project_id) {
      showToast('Phase Name and Project are required.', 'warning');
      return;
    }

    // Validation
    if (project) {
      if (payload.start_date && project.start_date && payload.start_date < project.start_date) {
        showToast('Phase dates must be within project duration', 'danger');
        return;
      }
      if (payload.end_date && project.end_date && payload.end_date > project.end_date) {
        showToast('Phase dates must be within project duration', 'danger');
        return;
      }
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await apiFetch('/v1/phases', { method: 'POST', body: JSON.stringify(payload) }, navigate);
      showToast('Phase created successfully.', 'success');
      form.reset();
      if (contextDiv) contextDiv.innerHTML = '';
    } catch (err) {
      showToast(err.message, 'danger');
    } finally { btn.disabled = false; }
  };

  form.addEventListener('submit', onSubmit);
  return () => {
    form.removeEventListener('submit', onSubmit);
    projectSelect?.removeEventListener('change', updateDateConstraints);
  };
}

function initCreateTaskForm(root, showToast, navigate) {
  const form = root.querySelector('#createTaskForm') || root.querySelector('[data-create-task-form]');
  if (!form) return undefined;

  const projectSelect = form.querySelector('#taskProject') || form.querySelector('#taskProjectSelect');
  const phaseSelect = form.querySelector('#taskPhase') || form.querySelector('#taskPhaseSelect');
  const startDateInput = root.querySelector('#taskStartDate');
  const dueDateInput = root.querySelector('#taskDueDate');
  
  // Find assignee select
  const assigneeSelect = Array.from(form.querySelectorAll('.form-group')).find(g => 
    g.querySelector('label')?.textContent.includes('Assign')
  )?.querySelector('select') || form.querySelectorAll('select')[2];

  // Context Displays
  const addContext = (el) => {
    if (!el) return null;
    let div = el.parentNode.querySelector('.form-context');
    if (!div) {
      div = document.createElement('div');
      div.className = 'form-context';
      div.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-top: 2px; min-height: 14px;';
      el.parentNode.appendChild(div);
    }
    return div;
  };
  const projectCtx = addContext(projectSelect);
  const phaseCtx = addContext(phaseSelect);

  let projectsData = [];
  let phasesData = [];

  const updateConstraints = () => {
    const pid = projectSelect.value;
    const phid = phaseSelect.value;
    const project = projectsData.find(p => String(p.id) === String(pid));
    const phase = phasesData.find(p => String(p.id) === String(phid));

    if (project && projectCtx) {
      const startStr = project.start_date ? formatDate(project.start_date) : 'N/A';
      const endStr = project.end_date ? formatDate(project.end_date) : 'N/A';
      projectCtx.innerHTML = `Project Duration: ${startStr} to ${endStr}`;
    } else if (projectCtx) projectCtx.innerHTML = '';

    if (phase && phaseCtx) {
      const startStr = phase.start_date ? formatDate(phase.start_date) : 'N/A';
      const endStr = phase.end_date ? formatDate(phase.end_date) : 'N/A';
      phaseCtx.innerHTML = `Phase Duration: ${startStr} to ${endStr}`;
      
      if (startDateInput) {
        startDateInput.min = phase.start_date || '';
        startDateInput.max = phase.end_date || '';
      }
      if (dueDateInput) {
        dueDateInput.min = phase.start_date || '';
        dueDateInput.max = phase.end_date || '';
      }
    } else if (phaseCtx) {
      phaseCtx.innerHTML = '';
      if (startDateInput) { startDateInput.min = ''; startDateInput.max = ''; }
      if (dueDateInput) { dueDateInput.min = ''; dueDateInput.max = ''; }
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    if (!projects || !Array.isArray(projects)) return;
    projectsData = projects;
    if (projectSelect) {
      projectSelect.innerHTML = '<option value="">Select project</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        projectSelect.appendChild(opt);
      });
    }
  });

  const onProjectChange = async () => {
    const pid = projectSelect.value;
    updateConstraints();
    
    if (!pid) {
      if (phaseSelect) {
        phaseSelect.innerHTML = '<option value="">Select phase</option>';
        phaseSelect.disabled = true;
      }
      return;
    }

    try {
      if (phaseSelect) phaseSelect.innerHTML = '<option value="">Loading phases...</option>';
      if (assigneeSelect) assigneeSelect.innerHTML = '<option value="">Loading engineers...</option>';

      const phases = await apiFetch(`/v1/phases/project/${pid}`, {}, navigate).catch(() => []);
      
      const project = projectsData.find(p => String(p.id) === String(pid));
      const team = project ? project.assignments : [];

      console.log(`[initCreateTaskForm] Project ${pid} from projectsData:`, project);
      phasesData = phases;
      
      // Lenient role filtering
      const engineers = (team || []).filter(m => {
        const r = (m.role || '').toLowerCase().replace('_', ' ');
        return r === 'site engineer' || r === 'site_engineer';
      });
      console.log(`[initCreateTaskForm] Filtered engineers from local data:`, engineers);

      if (phaseSelect) {
        phaseSelect.innerHTML = '<option value="">Select phase</option>';
        phases.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id; opt.textContent = p.name;
          phaseSelect.appendChild(opt);
        });
        phaseSelect.disabled = false;
      }

      if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">Select Site Engineer</option>';
        engineers.forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.user_id; opt.textContent = e.full_name || 'Unnamed Engineer';
          assigneeSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const phid = phaseSelect.value;
    const phase = phasesData.find(p => String(p.id) === String(phid));

    const payload = {
      phase_id: phid,
      name: form.querySelector('input[type="text"]').value.trim(),
      assigned_to: assigneeSelect?.value || null,
      priority: (Array.from(form.querySelectorAll('.form-group')).find(g => 
        g.querySelector('label')?.textContent.includes('Priority')
      )?.querySelector('select') || form.querySelectorAll('select')[3])?.value.toLowerCase() || 'medium',
      start_date: startDateInput?.value || null,
      due_date: dueDateInput?.value || null,
      status: 'not_started'
    };

    if (!payload.name || !payload.phase_id) {
      showToast('Task Title and Phase are required.', 'warning');
      return;
    }

    // Validation
    if (phase) {
      if (payload.start_date && phase.start_date && payload.start_date < phase.start_date) {
        showToast('Task dates must be within phase duration', 'danger');
        return;
      }
      if (payload.due_date && phase.end_date && payload.due_date > phase.end_date) {
        showToast('Task dates must be within phase duration', 'danger');
        return;
      }
    }

    try {
      await apiFetch('/v1/tasks', { method: 'POST', body: JSON.stringify(payload) }, navigate);
      showToast('Task created successfully.', 'success');
      form.reset();
      if (projectCtx) projectCtx.innerHTML = '';
      if (phaseCtx) phaseCtx.innerHTML = '';
      if (phaseSelect) phaseSelect.disabled = true;
    } catch (err) { showToast(err.message, 'danger'); }
  };

  projectSelect?.addEventListener('change', onProjectChange);
  phaseSelect?.addEventListener('change', updateConstraints);
  form.addEventListener('submit', onSubmit);
  return () => {
    projectSelect?.removeEventListener('change', onProjectChange);
    phaseSelect?.removeEventListener('change', updateConstraints);
    form.removeEventListener('submit', onSubmit);
  };
}

function initPmDashboard(root, showToast, navigate) {
  const statValues = root.querySelectorAll('.stat-card-value');
  const statChanges = root.querySelectorAll('.stat-card-change');
  statValues.forEach(v => { v.textContent = '—'; });

  apiFetch('/v1/projects', {}, navigate).then(async projects => {
    if (!projects || !Array.isArray(projects) || projects.length === 0) return;

    const currentProject = projects.find(p => p.status === 'active') || projects[0];
    try {
      const overviews = await apiFetch('/v1/analytics/overview', {}, navigate);
      const projOverview = Array.isArray(overviews) ? overviews.find(o => String(o.project_id) === String(currentProject.id)) : null;
      
      const ctx = root.querySelector('#pmCompletionChart')?.getContext('2d');
      if (ctx && Array.isArray(overviews)) {
        if (window.pmChart) window.pmChart.destroy();
        
        window.pmChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: overviews.map(o => o.project_name),
            datasets: [{
              label: 'Completion %',
              data: overviews.map(o => Math.round(o.progress_pct || 0)),
              backgroundColor: [
                'rgba(52, 152, 219, 0.8)',
                'rgba(46, 204, 113, 0.8)',
                'rgba(241, 196, 15, 0.8)',
                'rgba(230, 126, 34, 0.8)',
                'rgba(231, 76, 60, 0.8)',
                'rgba(155, 89, 182, 0.8)'
              ],
              borderRadius: 8,
              borderSkipped: false,
              barThickness: 24,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 12,
                callbacks: {
                  label: (c) => ` Completion: ${c.raw}%`
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                max: 100,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { callback: (v) => v + '%' }
              },
              y: {
                grid: { display: false },
                ticks: { font: { weight: '600', size: 12 } }
              }
            }
          }
        });
      }

      if (projOverview) {
        const ts = projOverview.task_stats || {};
        if (statValues[0]) statValues[0].textContent = `${Math.round(projOverview.progress_pct || 0)}%`;
        if (statValues[1]) statValues[1].textContent = ts.in_progress || 0;
        if (statChanges[0]) statChanges[0].innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">task_alt</span> ${ts.completed || 0} completed, ${ts.total || 0} total`;
        if (statChanges[1]) statChanges[1].innerHTML = `<span class="material-symbols-outlined" style="font-size:14px">info</span> ${ts.not_started || 0} not started`;
        const delayed = ts.delayed || 0;
        if (statValues[3]) statValues[3].textContent = delayed;
        if (statChanges[3]) statChanges[3].innerHTML = delayed > 0 
          ? `<span class="material-symbols-outlined" style="font-size:14px">trending_down</span> ${delayed} need attention` 
          : `<span class="material-symbols-outlined" style="font-size:14px">check_circle</span> All on track`;
      }
      const budgetData = await apiFetch(`/v1/analytics/budget?project_id=${currentProject.id}`, {}, navigate);
      if (budgetData && statValues[2]) {
        const spent = budgetData.total_spent || 0;
        statValues[2].textContent = spent >= 10000000 ? `₹${(spent / 10000000).toFixed(2)} Cr` : `₹${spent.toLocaleString('en-IN')}`;
        if (statChanges[2]) statChanges[2].textContent = `${Math.round(budgetData.budget_used_pct || 0)}% of budget used`;
      }


      const activities = await apiFetch('/v1/analytics/recent-activity', {}, navigate);
      const feed = root.querySelector('.activity-feed');
      if (feed && activities) {
        const recent = activities.slice(0, 5);
        if (recent.length === 0) {
          feed.innerHTML = '<div style="padding: 10px; color: var(--text-muted);">No recent activity.</div>';
        } else {
          feed.innerHTML = recent.map(a => `
            <div class="activity-item">
              <div class="activity-dot ${a.color}"></div>
              <div class="activity-content">
                <h4>${a.title}</h4>
                <p>${a.description}</p>
                <span class="activity-time">${a.time_ago}</span>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (e) { console.error(e); }
  });
}

function initManageTasks(root, showToast, navigate) {
  const projectSelect = root.querySelector('#taskProjectSelect');
  const phaseSelect = root.querySelector('#taskPhaseSelect');
  const body = root.querySelector('[data-pm-task-table] tbody');

  if (!projectSelect || !phaseSelect || !body) return;

  const formatDate = (d) => { if (!d) return '—'; const dt = new Date(d); if (isNaN(dt.getTime())) return '—'; return `${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleDateString('en-GB',{month:'short'})} ${dt.getFullYear()}`; };
  let allUsers = [];

  const loadTasks = async () => {
    const phaseId = phaseSelect?.value;
    if (!phaseId) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">Select a phase to view tasks</td></tr>';
      return;
    }
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">Loading tasks…</td></tr>';
    try {
      const [tasks, users] = await Promise.all([
        apiFetch(`/v1/tasks/phase/${phaseId}`, {}, navigate),
        apiFetch('/v1/users', {}, navigate)
      ]);
      allUsers = users;
      const userMap = {};
      users.forEach(u => userMap[u.id] = u.full_name || u.name);
      
      body.innerHTML = tasks.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:24px">No tasks found.</td></tr>' : '';
      tasks.forEach(task => {
        const tr = document.createElement('tr');
        const engineerName = userMap[task.assigned_to] || 'Unassigned';
        tr.innerHTML = `
          <td><strong>${task.name}</strong></td>
          <td>${engineerName}</td>
          <td>${task.phase_name || '-'}</td>
          <td>${formatDate(task.due_date)}</td>
          <td><span class="status-badge ${task.priority === 'high' || task.priority === 'critical' ? 'overdue' : 'pending'}">${task.priority || 'medium'}</span></td>
          <td><span class="status-badge ${task.status==='completed'?'active':task.status==='in_progress'?'progress':'pending'}">${(task.status || 'not_started').replace('_', ' ')}</span></td>
          <td style="text-align:right">
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-sm btn-outline" data-view-task="${task.id}" style="padding:6px 16px; border-radius:4px; font-weight:600;">View</button>
              <button class="btn btn-sm btn-primary" data-edit-task="${task.id}" style="padding:6px 16px; border-radius:4px; font-weight:600; color:white;">Edit</button>
            </div>
          </td>
        `;
        body.appendChild(tr);
      });

      body.querySelectorAll('[data-view-task]').forEach(btn => {
        btn.addEventListener('click', () => {
          navigate(`/pm/view-task?id=${btn.dataset.viewTask}`);
        });
      });

      body.querySelectorAll('[data-edit-task]').forEach(btn => {
        btn.addEventListener('click', () => {
          navigate(`/pm/edit-task?id=${btn.dataset.editTask}`);
        });
      });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:red">Error: ${err.message}</td></tr>`;
    }
  };

  const onProjectChange = async (autoSelectPhaseId = null) => {
    const pid = projectSelect.value;
    if (pid) {
      sessionStorage.setItem('pmManageTasksProjectId', pid);
    } else {
      sessionStorage.removeItem('pmManageTasksProjectId');
    }
    
    phaseSelect.innerHTML = '<option value="">-- Select Phase --</option>';
    if (!pid) return;
    try {
      const phases = await apiFetch(`/v1/phases/project/${pid}`, {}, navigate);
      phases.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        phaseSelect.appendChild(opt);
      });
      
      if (autoSelectPhaseId && typeof autoSelectPhaseId === 'string') {
        phaseSelect.value = autoSelectPhaseId;
        if (phaseSelect.value === autoSelectPhaseId) {
          loadTasks();
        }
      }
    } catch (e) { showToast('Failed to load phases', 'danger'); }
  };

  const savedPid = sessionStorage.getItem('pmManageTasksProjectId');
  const savedPhaseId = sessionStorage.getItem('pmManageTasksPhaseId');

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    if (!projects || projects.length === 0) {
      showToast('No projects found.', 'warning');
      return;
    }
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });
    
    if (savedPid) {
      projectSelect.value = savedPid;
      if (projectSelect.value === savedPid) {
        onProjectChange(savedPhaseId);
        return;
      }
    }
    
    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      onProjectChange();
    }
  }).catch(err => {
    showToast('Failed to load projects: ' + err.message, 'danger');
  });

  projectSelect?.addEventListener('change', () => {
    sessionStorage.removeItem('pmManageTasksPhaseId');
    onProjectChange();
  });
  
  phaseSelect?.addEventListener('change', () => {
    const phid = phaseSelect.value;
    if (phid) {
      sessionStorage.setItem('pmManageTasksPhaseId', phid);
    } else {
      sessionStorage.removeItem('pmManageTasksPhaseId');
    }
    loadTasks();
  });

  return () => {
    projectSelect?.removeEventListener('change', onProjectChange);
    phaseSelect?.removeEventListener('change', loadTasks);
  };
}

function initSeDashboard(root, showToast, navigate) {
  const welcomeText = root.querySelector('#seWelcomeText');
  const valMyTasks = root.querySelector('#valMyTasks');
  const descMyTasks = root.querySelector('#descMyTasks');
  const valTodayStatus = root.querySelector('#valTodayStatus');
  const descTodayStatus = root.querySelector('#descTodayStatus');
  const valWeekHours = root.querySelector('#valWeekHours');
  const descWeekHours = root.querySelector('#descWeekHours');
  const taskTableBody = root.querySelector('#dashboardTaskBody');

  if (!taskTableBody) return undefined;

  const auth = JSON.parse(localStorage.getItem('am_auth') || '{}');
  const currentUserId = auth.id; 
  const currentUserName = auth.name || '';

  if (welcomeText) {
    welcomeText.textContent = `Good Morning, ${currentUserName.split(' ')[0]}`;
  }

  const loadDashboardData = async () => {
    try {
      if (valMyTasks) valMyTasks.textContent = '...';
      if (valTodayStatus) valTodayStatus.textContent = '...';
      if (valWeekHours) valWeekHours.textContent = '...';

      const [myTasks, allAttendance] = await Promise.all([
        apiFetch('/v1/tasks/assigned', {}, navigate),
        apiFetch('/v1/attendance/my', {}, navigate).catch(() => [])
      ]);

      // Stat 1: My Tasks
      const totalTasks = myTasks.length;
      const doneTasks = myTasks.filter(t => t.status === 'completed');
      const delayedTasks = myTasks.filter(t => t.is_delayed);
      if (valMyTasks) valMyTasks.textContent = totalTasks;
      if (descMyTasks) descMyTasks.textContent = `${doneTasks.length} done · ${delayedTasks.length} delayed`;

      // Recent Task Table
      taskTableBody.innerHTML = '';
      if (myTasks.length === 0) {
        taskTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No tasks assigned.</td></tr>';
      } else {
        const sorted = [...myTasks].sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        });
        taskTableBody.innerHTML = sorted.slice(0, 8).map(task => {
          const statusCls = task.status === 'completed' ? 'active' : task.is_delayed ? 'overdue' : task.status === 'in_progress' ? 'progress' : 'pending';
          const label = (task.status || 'not_started').replace(/_/g, ' ');
          return `
            <tr>
              <td>${task.name}</td>
              <td>${task.phase_name || '-'}</td>
              <td>${task.due_date ? formatDate(task.due_date) : '-'}</td>
              <td><span class="status-badge ${statusCls}">${label}</span></td>
            </tr>
          `;
        }).join('');
      }

      // Stat 2: Attendance Status
      const myAttendance = Array.isArray(allAttendance) ? allAttendance : [];
      const d = new Date();
      const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const todayRec = myAttendance.find(a => (a.attendance_date || '').startsWith(todayStr));
      
      if (todayRec) {
        if (todayRec.check_out) {
          if (valTodayStatus) valTodayStatus.textContent = 'Checked Out';
          if (descTodayStatus) descTodayStatus.textContent = 'Shift completed';
        } else {
          if (valTodayStatus) valTodayStatus.textContent = 'Checked In';
          if (descTodayStatus) descTodayStatus.textContent = 'In progress';
        }
      } else {
        if (valTodayStatus) valTodayStatus.textContent = 'Not Checked In';
        if (descTodayStatus) descTodayStatus.textContent = 'No record today';
      }

      // Stat 3: Week Hours
      const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekRecs = myAttendance.filter(a => new Date(a.attendance_date) >= oneWeekAgo);
      const totalHours = weekRecs.reduce((s, r) => s + (r.total_hours || 0), 0);
      if (valWeekHours) valWeekHours.textContent = totalHours.toFixed(1) + 'h';
      if (descWeekHours) descWeekHours.textContent = `${weekRecs.length} day(s) logged`;

    } catch (err) {
      console.error('SE dashboard error:', err);
      showToast('Failed to load dashboard data', 'danger');
    }
  };

  loadDashboardData();
  return undefined;
}

function initClientDashboard(root, showToast, navigate) {
  const projectSelect = root.querySelector('#clientProjectSelect');
  const content = root.querySelector('#clientDashboardContent');
  const cdProgress = root.querySelector('#cdProgress');
  const cdStatus = root.querySelector('#cdStatus');
  const cdTimeline = root.querySelector('#cdTimeline');
  const cdBarLabel = root.querySelector('#cdBarLabel');
  const cdBarStatus = root.querySelector('#cdBarStatus');
  const cdBarFill = root.querySelector('#cdBarFill');

  if (!projectSelect || !content) return undefined;

  const onProjectChange = async (e) => {
    const val = e.target.value;
    if (!val) { 
      content.style.display = 'none'; 
      return; 
    }

    try {
      content.style.display = 'none';
      
      const [overviews] = await Promise.all([
        apiFetch('/v1/analytics/overview', {}, navigate)
      ]);

      const projectOverview = overviews.find(o => String(o.project_id) === String(val));
      if (projectOverview) {
        const pct = Math.round(projectOverview.progress_pct || 0);
        if (cdProgress) cdProgress.innerText = pct + "%";
        
        let badgeClass = "pending";
        let statusText = projectOverview.status || "Planning";
        if (statusText.toLowerCase() === 'active' || statusText.toLowerCase() === 'in progress') badgeClass = "active";
        if (statusText.toLowerCase() === 'completed') badgeClass = "progress";
        if (statusText.toLowerCase() === 'on hold' || statusText.toLowerCase() === 'delayed') badgeClass = "overdue";

        if (cdStatus) {
          cdStatus.className = "status-badge " + badgeClass;
          cdStatus.innerText = statusText.charAt(0).toUpperCase() + statusText.slice(1);
        }
        
        const start = projectOverview.start_date ? formatDate(projectOverview.start_date) : '--';
        const end = projectOverview.end_date ? formatDate(projectOverview.end_date) : '--';
        if (cdTimeline) cdTimeline.innerText = `${start} to ${end}`;
        
        if (cdBarLabel) cdBarLabel.innerText = pct + "%";
        if (cdBarStatus) cdBarStatus.innerText = statusText.charAt(0).toUpperCase() + statusText.slice(1);
        if (cdBarFill) cdBarFill.style.width = pct + "%";
        
        content.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load project details', 'danger');
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">Select Project</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });

    projectSelect.addEventListener('change', onProjectChange);
    
    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      const event = { target: { value: projects[0].id } };
      onProjectChange(event);
    }
  }).catch(err => {
    console.error(err);
    showToast('Failed to load projects', 'danger');
    projectSelect.innerHTML = '<option value="">Error loading</option>';
  });

  return () => {
    projectSelect.removeEventListener('change', onProjectChange);
  };
}

function initSiteEngineerTaskBoard(root, showToast, navigate) {
  const body = root.querySelector('#seTaskTable tbody');
  if (!body) return undefined;

  const auth = JSON.parse(localStorage.getItem('am_auth') || '{}');
  const currentUserId = auth.id;

  const loadTasks = async () => {
    try {
      const allTasks = await apiFetch('/v1/tasks', {}, navigate);
      const myTasks = allTasks.filter(t => String(t.assigned_to) === String(currentUserId));
      
      body.innerHTML = myTasks.length === 0 
        ? '<tr><td colspan="5" style="text-align:center;padding:20px;">No tasks assigned to you.</td></tr>'
        : myTasks.map(t => {
            const dueDisplay = t.due_date ? formatDate(t.due_date) : 'No due date';
            const escapedDesc = (t.description || 'No description provided.').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `
              <tr data-task-id="${t.id}" class="clickable-task-row" style="cursor:pointer;" title="Click to view details">
                <td><strong>${t.name}</strong></td>
                <td>${t.phase_name || '-'}</td>
                <td>${dueDisplay}</td>
                <td><span class="status-badge ${t.priority === 'high' ? 'overdue' : (t.priority === 'low' ? 'progress' : 'pending')}">${t.priority}</span></td>
                <td onclick="event.stopPropagation()">
                  <div class="status-update-wrapper">
                    <select class="form-select se-status-select">
                      <option value="not_started" ${t.status === 'not_started' ? 'selected' : ''}>Not Started</option>
                      <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                      <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                  </div>
                </td>
              </tr>
              <tr id="desc-${t.id}" style="display:none; background-color: var(--surface-hover);">
                <td colspan="5" style="padding: 16px; border-top: 1px dashed var(--border-color);">
                  <div style="font-size: 13px;">
                    <strong style="color: var(--text-color);">Description:</strong>
                    <div style="margin-top: 6px; color: var(--text-muted); white-space: pre-wrap; line-height: 1.5;">${escapedDesc}</div>
                  </div>
                </td>
              </tr>
            `;
          }).join('');

      body.querySelectorAll('.clickable-task-row').forEach(row => {
        row.addEventListener('click', () => {
          const tid = row.dataset.taskId;
          const descRow = body.querySelector(`#desc-${tid}`);
          if (descRow) {
            descRow.style.display = descRow.style.display === 'none' ? 'table-row' : 'none';
          }
        });
      });

      body.querySelectorAll('.se-status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
          const tid = e.target.closest('tr').dataset.taskId;
          const status = e.target.value;
          e.target.disabled = true;
          try {
            await apiFetch(`/v1/tasks/${tid}`, {
              method: 'PATCH',
              body: JSON.stringify({ status })
            }, navigate);
            showToast('Status updated.', 'success');
          } catch (err) {
            showToast(err.message, 'danger');
          } finally {
            e.target.disabled = false;
          }
        });
      });
    } catch (err) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:red;">Error loading tasks.</td></tr>';
    }
  };

  loadTasks();
  return undefined;
}

function initAttendanceView(root, showToast, navigate) {
  const projectSelect = root.querySelector('#attendanceProjectSelect');
  const tbody = root.querySelector('#attendanceTable tbody');
  const valTotalRecords = root.querySelector('#valTotalRecords');
  const valTotalHours = root.querySelector('#valTotalHours');
  const valAttendanceRate = root.querySelector('#valAttendanceRate');

  if (!projectSelect || !tbody) return undefined;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return '—';
    return `${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleDateString('en-GB',{month:'short'})} ${dt.getFullYear()}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatHours = (hoursFloat) => {
    if (hoursFloat === null || hoursFloat === undefined) return '—';
    const hrs = Math.floor(hoursFloat);
    const mins = Math.round((hoursFloat - hrs) * 60);
    return `${hrs}h ${mins > 0 ? mins + 'm' : ''}`;
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });
  });

  const onProjectChange = async () => {
    const projectId = projectSelect.value;
    if (!projectId) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px;">Select a project to view attendance</td></tr>';
      if (valTotalRecords) valTotalRecords.textContent = '0';
      if (valTotalHours) valTotalHours.textContent = '0h';
      if (valAttendanceRate) valAttendanceRate.textContent = '0%';
      return;
    }

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px;">Loading records...</td></tr>';
    
    try {
      const records = await apiFetch(`/v1/attendance/project/${projectId}`, {}, navigate);

      if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px;">No attendance records found.</td></tr>';
        if (valTotalRecords) valTotalRecords.textContent = '0';
        if (valTotalHours) valTotalHours.textContent = '0h';
        if (valAttendanceRate) valAttendanceRate.textContent = '0%';
        return;
      }

      records.sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date));

      tbody.innerHTML = '';
      let totalHoursAgg = 0;
      let presentCount = 0;

      records.forEach(record => {
        const tr = document.createElement('tr');
        if (record.total_hours) totalHoursAgg += Number(record.total_hours);
        
        let statusClass = 'active';
        let statusText = 'Present';
        
        if (record.status) {
          const lowerStatus = record.status.toLowerCase();
          if (lowerStatus === 'late') { statusClass = 'pending'; statusText = 'Late'; }
          else if (lowerStatus === 'absent') { statusClass = 'overdue'; statusText = 'Absent'; }
          else if (lowerStatus === 'present') { presentCount++; }
        }

        tr.innerHTML = `
          <td><strong>${record.user_name || 'Unknown'}</strong></td>
          <td>${formatDate(record.attendance_date)}</td>
          <td>${formatTime(record.check_in)}</td>
          <td>${formatTime(record.check_out)}</td>
          <td>${formatHours(record.total_hours)}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
      });

      if (valTotalRecords) valTotalRecords.textContent = String(records.length);
      if (valTotalHours) valTotalHours.textContent = formatHours(totalHoursAgg);
      if (valAttendanceRate) valAttendanceRate.textContent = (presentCount / records.length * 100).toFixed(1) + '%';

    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:red;">Failed to load attendance</td></tr>';
    }
  };

  projectSelect.addEventListener('change', onProjectChange);
  return () => projectSelect.removeEventListener('change', onProjectChange);
}

function initBudgetPage(root, showToast, navigate) {
  const projectSelect = root.querySelector('#adminProjectSelect') || root.querySelector('#budgetProjectSelect');
  const detailsPanel = root.querySelector('#budgetContent') || root.querySelector('#budgetDetailsPanel');
  const emptyState = root.querySelector('#budgetEmptyState');
  const globalList = root.querySelector('#globalBudgetList');
  if (!projectSelect) return undefined;

  // Load global budget status
  if (globalList) {
    apiFetch('/v1/analytics/overview', {}, navigate)
      .then(overviews => {
        if (overviews && overviews.length > 0) {
          globalList.innerHTML = overviews.map(o => {
            const bPct = Math.round(o.budget_used_pct || 0);
            const fillClass = bPct > 90 ? 'red' : (bPct > 70 ? 'orange' : 'green');
            return `
              <div class="progress-bar-wrapper" style="margin-bottom:20px;">
                <div class="progress-label">
                  <span style="font-weight:600;">${o.project_name}</span>
                  <span style="font-weight:700;">${bPct}% spent</span>
                </div>
                <div class="progress-track"><div class="progress-fill ${fillClass}" style="width:${bPct}%;transition:width 0.8s ease;"></div></div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Total Budget: ₹${(o.budget || 0).toLocaleString('en-IN')}</div>
              </div>
            `;
          }).join('');
        } else {
          globalList.innerHTML = '<div style="text-align:center;color:var(--text-muted)">No project data found.</div>';
        }
      })
      .catch(err => {
        console.error('Failed global overview:', err);
        globalList.innerHTML = '<div style="text-align:center;color:var(--danger)">Failed to load global budget data.</div>';
      });
  }

  const loadBudget = async () => {
    const pid = projectSelect.value;
    if (!pid) {
      if (detailsPanel) detailsPanel.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'Loading budget details...';
    }
    if (detailsPanel) detailsPanel.style.display = 'none';

    try {
      const summary = await apiFetch(`/v1/expenses/summary/project/${pid}`, {}, navigate);
      
      const b = summary.total_budget || 0;
      const s = summary.total_spent || 0;
      const r = summary.remaining_budget || 0;

      const mat = summary.total_material_cost || 0;
      const exp = summary.total_expenses || 0;

      const formatCurrency = (val) => '₹' + Number(val).toLocaleString('en-IN');

      const setVal = (id, val) => { const el = root.querySelector('#' + id); if (el) el.textContent = val; };
      setVal('valTotalBudget', formatCurrency(b));
      
      const remEl = root.querySelector('#valRemaining');
      if (remEl) {
        remEl.textContent = r < 0 ? '-₹' + Math.abs(r).toLocaleString('en-IN') : formatCurrency(r);
        remEl.style.color = r < 0 ? 'var(--danger)' : 'var(--success)';
      }
      
      const pct = b > 0 ? Math.min(100, Math.round((s / b) * 100)) : 0;
      setVal('lblSpent', `${formatCurrency(s)} spent`);
      setVal('lblPct', `${pct}%`);
      setVal('valTotalSpent', formatCurrency(s));
      setVal('valUtilization', `${pct}%`);
      setVal('valTotalExpenses', formatCurrency(exp));
      setVal('valMaterialCost', formatCurrency(mat));
      
      const bar = root.querySelector('#barUtilization');
      if (bar) {
        bar.style.width = pct + '%';
        bar.className = 'progress-fill ' + (pct > 90 ? 'red' : (pct > 70 ? 'orange' : 'blue'));
      }

      // Fallback for legacy prog elements if they exist
      const progLabelOverall = root.querySelector('#progLabelOverall');
      if (progLabelOverall) {
        progLabelOverall.textContent = `${formatCurrency(s)} / ${formatCurrency(b)} (${pct}%)`;
        root.querySelector('#progFillOverall').style.width = pct + '%';

        const matPct = b > 0 ? (mat / b * 100) : 0;
        root.querySelector('#progLabelMaterial').textContent = `${formatCurrency(mat)} (${matPct.toFixed(1)}% of budget)`;
        root.querySelector('#progFillMaterial').style.width = Math.min(matPct, 100) + '%';

        const expPct = b > 0 ? (exp / b * 100) : 0;
        root.querySelector('#progLabelExpenses').textContent = `${formatCurrency(exp)} (${expPct.toFixed(1)}% of budget)`;
        root.querySelector('#progFillExpenses').style.width = Math.min(expPct, 100) + '%';
      }

      if (emptyState) emptyState.style.display = 'none';
      if (detailsPanel) detailsPanel.style.display = 'block';
    } catch (err) {
      showToast(err.message, 'danger');
      if (emptyState) emptyState.textContent = 'Error loading budget details.';
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
    projectSelect.addEventListener('change', loadBudget);
  });

  return () => projectSelect.removeEventListener('change', loadBudget);
}

function initAnalyticsPage(root, showToast, navigate) {
  const projectSelect = root.querySelector('#analyticsProjectSelect') || root.querySelector('#adminProjectSelect');
  const statsGrid = root.querySelector('#analyticsStatsGrid');
  const taskPanel = root.querySelector('#analyticsTaskPanel');
  const emptyState = root.querySelector('#analyticsEmptyState');
  if (!projectSelect) return undefined;

  const loadAnalytics = async () => {
    const pid = projectSelect.value;
    if (!pid) {
      if (statsGrid) statsGrid.style.display = 'none';
      if (taskPanel) taskPanel.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    try {
      if (emptyState) emptyState.style.display = 'none';
      const overviews = await apiFetch('/v1/analytics/overview', {}, navigate);
      const o = overviews.find(ov => String(ov.project_id) === String(pid));
      if (o) {
        const setVal = (id, val) => { const el = root.querySelector('#' + id); if (el) el.textContent = val; };
        setVal('valProgress', Math.round(o.progress_pct) + '%');
        const ts = o.task_stats || {};
        setVal('descProgress', (ts.total || 0) + ' total tasks');
        setVal('lblCompleted', 'Completed: ' + (ts.completed || 0));
        setVal('lblInProgress', 'In Progress: ' + (ts.in_progress || 0));
        setVal('lblNotStarted', 'Not Started: ' + (ts.not_started || 0));
        setVal('lblDelayed', 'Delayed: ' + (ts.delayed || 0));
        const t = ts.total || 1;
        const setBar = (id, val) => { const el = root.querySelector('#' + id); if (el) el.style.width = (val / t * 100) + '%'; };
        setBar('barCompleted', ts.completed || 0);
        setBar('barInProgress', ts.in_progress || 0);
        setBar('barNotStarted', ts.not_started || 0);
        setBar('barDelayed', ts.delayed || 0);
      }
      const [budget, materials, attendance] = await Promise.all([
        apiFetch(`/v1/analytics/budget?project_id=${pid}`, {}, navigate),
        apiFetch(`/v1/analytics/materials?project_id=${pid}`, {}, navigate),
        apiFetch(`/v1/analytics/attendance-summary?project_id=${pid}`, {}, navigate)
      ]);
      const setVal = (id, val) => { const el = root.querySelector('#' + id); if (el) el.textContent = val; };
      if (budget) {
        setVal('valBudget', Math.round(budget.budget_used_pct || 0) + '%');
        setVal('descBudget', '₹' + (budget.remaining_budget || 0).toLocaleString() + ' remaining');
      }
      if (materials) {
        setVal('valMaterials', (materials.total_material_types || 0) + ' types');
        setVal('descMaterials', (materials.low_stock_items || 0) + ' low stock');
      }
      if (attendance) {
        setVal('valAttendance', (attendance.total_checkins || 0) + ' check-ins');
        setVal('descAttendance', (attendance.total_hours_logged || 0) + ' hours');
      }
      if (statsGrid) statsGrid.style.display = 'grid';
      if (taskPanel) taskPanel.style.display = 'block';
    } catch (err) { showToast(err.message, 'danger'); }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">Select Project</option>';
    projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
    projectSelect.addEventListener('change', loadAnalytics);
  });

  return () => projectSelect.removeEventListener('change', loadAnalytics);
}

function initAdminDashboard(root, showToast, navigate) {
  const statValues = root.querySelectorAll('.stat-card-value');
  // Fetch overview to calculate counts based on progress
  apiFetch('/v1/analytics/overview', {}, navigate).then(overviews => {
    if (!overviews || !Array.isArray(overviews)) return;
    
    const total = overviews.length;
    const activeCount = overviews.filter(o => {
      const p = o.progress_pct || 0;
      return p > 0 && p < 100;
    }).length;
    const completedCount = overviews.filter(o => (o.progress_pct || 0) === 100).length;
    
    const statValues = root.querySelectorAll('.stat-card-value');
    if (statValues.length >= 4) {
      statValues[0].textContent = total < 10 ? `0${total}` : total;
      statValues[1].textContent = completedCount < 10 ? `0${completedCount}` : completedCount;
      // Card 4: Active Projects
      statValues[3].textContent = activeCount < 10 ? `0${activeCount}` : activeCount;
    }
  }).catch(console.error);

  if (statValues.length >= 4) {
    apiFetch('/v1/admin/users/count', {}, navigate).then(data => {
       // Optional: We can still keep users count somewhere else if needed, 
       // but here we are overriding statValues[1] with Completed Projects
    }).catch(console.error);
    
    apiFetch('/v1/admin/projects/budget-summary', {}, navigate).then(data => {
      const spent = data.total_budget || 0;
      if (spent >= 10000000) {
        statValues[2].textContent = `₹${(spent / 10000000).toFixed(2)} Cr`;
      } else {
        statValues[2].textContent = `₹${spent.toLocaleString('en-IN')}`;
      }
    }).catch(console.error);
  }

  // Handle Enterprise Progress Flow Graph
  apiFetch('/v1/analytics/overview', {}, navigate).then(projects => {
    // Look for the canvas we added or the body container
    const chartContainer = root.querySelector('#enterpriseProgressBody');
    if (chartContainer && Array.isArray(projects)) {
      if (projects.length === 0) {
        chartContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No projects found to display graph.</div>';
      } else {
        // Ensure there is a canvas
        let canvas = chartContainer.querySelector('canvas');
        if (!canvas) {
          chartContainer.innerHTML = '<canvas id="enterpriseChart"></canvas>';
          chartContainer.style.position = 'relative';
          chartContainer.style.height = '350px';
          canvas = chartContainer.querySelector('canvas');
        }
        
        const labels = projects.map(p => p.project_name || p.name);
        const dataPoints = projects.map(p => Math.round(p.progress_pct || 0));
        const bgColors = projects.map(p => {
          const pct = p.progress_pct || 0;
          if (pct >= 80) return 'rgba(39, 174, 96, 0.8)';
          if (pct >= 40) return 'rgba(52, 152, 219, 0.8)';
          return 'rgba(230, 126, 34, 0.8)';
        });

        if (window.Chart) {
          new window.Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Project Progress (%)',
                data: dataPoints,
                backgroundColor: bgColors,
                borderRadius: 4,
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }
            }
          });
        } else {
          chartContainer.innerHTML = '<div style="text-align:center;padding:20px;color:red;">Chart.js failed to load.</div>';
        }
      }
    }
  }).catch(console.error);

  const viewDetailsBtn = root.querySelector('[data-action="view-projects"]');
  if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener('click', () => navigate('/admin/project-list.html'));
  }

  // System Logs
  let allActivities = [];
  const fetchLogs = () => {
    apiFetch('/v1/analytics/recent-activity', {}, navigate).then(activities => {
      allActivities = activities || [];
      const panels = root.querySelectorAll('.panel');
      let logsBody = null;
      let viewAllLink = null;
      panels.forEach(p => {
        const title = p.querySelector('.panel-title');
        if (title && title.textContent.trim() === 'System Logs') {
          logsBody = p.querySelector('.panel-body');
          viewAllLink = p.querySelector('.panel-action');
        }
      });

      if (logsBody && Array.isArray(activities)) {
        if (activities.length === 0) {
          logsBody.innerHTML = '<div style="padding: 20px; color: var(--text-muted);">No recent logs.</div>';
        } else {
          const displayLogs = activities.slice(0, 5);
          logsBody.innerHTML = '<div class="activity-feed">' + displayLogs.map(a => `
            <div class="activity-item">
              <div class="activity-dot ${a.color}"></div>
              <div class="activity-content">
                <h4>${a.title}</h4>
                <p>${a.description}</p>
                <span class="activity-time">${a.time_ago}</span>
              </div>
            </div>`).join('') + '</div>';
        }
      }
      
      if (viewAllLink) {
        viewAllLink.onclick = () => {
          navigate('/admin/system-logs.html');
        };
        viewAllLink.style.cursor = 'pointer';
        viewAllLink.style.color = 'var(--primary)';
      }
    }).catch(console.error);
  };

  fetchLogs();
  const logInterval = setInterval(fetchLogs, 30000);
  
  // Close modal
  const closeModalBtn = document.getElementById('closeSystemLogsBtn');
  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
       document.getElementById('systemLogsModal').style.display = 'none';
    };
  }

  // Blueprint Status
  apiFetch('/v1/analytics/overview', {}, navigate).then(projects => {
    const blueprintBody = root.querySelector('#blueprintStatusBody');
    if (blueprintBody && Array.isArray(projects)) {
      blueprintBody.innerHTML = '';
      projects.forEach(project => {
        const progress = typeof project.progress_pct === 'number' ? project.progress_pct : 0;
        let colorClass = '';
        if (progress >= 80) colorClass = ' green';
        else if (progress >= 40) colorClass = ' blue';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'progress-bar-wrapper';
        wrapper.innerHTML = `
          <div class="progress-label">
            <span>${project.name}</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill${colorClass}" style="width:${progress}%"></div>
          </div>
        `;
        blueprintBody.appendChild(wrapper);
      });
    }
  }).catch(err => {
    console.error('Blueprint Status failed:', err);
  });

  return () => clearInterval(logInterval);
}

function initSystemLogsPage(root, showToast, navigate) {
  const feed = root.querySelector('#fullSystemLogsFeed');
  if (!feed) return undefined;

  const loadLogs = async () => {
    feed.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading logs...</div>';
    try {
      const activities = await apiFetch('/v1/analytics/recent-activity?limit=1000', {}, navigate);
      if (!activities || activities.length === 0) {
        feed.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No activity found in the system yet.</div>';
        return;
      }
      
      feed.innerHTML = activities.map(a => `
        <div class="activity-item" style="padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div class="activity-dot ${a.color || 'blue'}"></div>
          <div class="activity-content" style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4 style="margin: 0 0 4px 0; font-size: 15px;">${a.title}</h4>
              <p style="margin: 0; color: var(--text-muted); font-size: 14px;">${a.description}</p>
            </div>
            <span class="activity-time" style="white-space: nowrap; font-size: 13px; color: var(--text-light); background: var(--bg-hover); padding: 2px 8px; border-radius: 12px;">${a.time_ago}</span>
          </div>
        </div>`).join('');
        
    } catch (err) {
      console.error('Failed to load logs:', err);
      feed.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Failed to load system logs. Please try again.</div>';
    }
  };
  
  loadLogs();
  
  const refreshBtn = root.querySelector('.panel-header .btn-outline');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadLogs);
  }
  
  return () => {
    if (refreshBtn) refreshBtn.removeEventListener('click', loadLogs);
  };
}

function initProjectList(root, showToast, navigate) {
  const tbody = root.querySelector('.task-table tbody');
  if (!tbody) return undefined;

  const loadProjects = async () => {
    try {
      const [projects, allUsers, overviews] = await Promise.all([
        apiFetch('/v1/projects', {}, navigate),
        apiFetch('/v1/users', {}, navigate),
        apiFetch('/v1/analytics/overview', {}, navigate).catch(() => [])
      ]);

      // Calculate status based on progress for counts and table
      const projectsWithStatus = projects.map(p => {
        const overview = overviews ? overviews.find(o => String(o.project_id) === String(p.id)) : null;
        const progress = overview ? (Number(overview.progress_pct) || 0) : 0;
        let calcStatus = 'planning';
        if (progress >= 100) calcStatus = 'completed';
        else if (progress > 0) calcStatus = 'active';
        
        return { ...p, calcStatus, progress };
      });

      const activeCount = projectsWithStatus.filter(p => p.calcStatus === 'active').length;
      const completedCount = projectsWithStatus.filter(p => p.calcStatus === 'completed').length;
      const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
      
      // Update top stats
      const statValues = root.querySelectorAll('.stat-card-value');
      if (statValues.length >= 4) {
        statValues[0].textContent = projects.length < 10 ? `0${projects.length}` : projects.length;
        statValues[1].textContent = activeCount < 10 ? `0${activeCount}` : activeCount;
        statValues[2].textContent = completedCount < 10 ? `0${completedCount}` : completedCount;
        
        if (totalBudget >= 10000000) {
          statValues[3].textContent = `₹${(totalBudget / 10000000).toFixed(2)} Cr`;
        } else {
          statValues[3].textContent = `₹${totalBudget.toLocaleString('en-IN')}`;
        }
      }

      const userMap = {};
      allUsers.forEach(u => userMap[u.id] = u.full_name);

      if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px">No projects found.</td></tr>';
        return;
      }

      tbody.innerHTML = projectsWithStatus.map(p => {
        let pmName = '-';
        if (p.manager_id && userMap[p.manager_id]) {
          pmName = userMap[p.manager_id];
        }

        let badgeClass = 'pending';
        let statusText = p.calcStatus.charAt(0).toUpperCase() + p.calcStatus.slice(1);
        
        if (p.calcStatus === 'active') badgeClass = 'progress';
        else if (p.calcStatus === 'completed') badgeClass = 'active';
        
        const budgetText = p.budget >= 10000000 
          ? `₹${(p.budget / 10000000).toFixed(2)} Cr` 
          : (p.budget ? `₹${p.budget.toLocaleString('en-IN')}` : '-');

        const progressText = `${Math.round(p.progress)}%`;

        return `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.location || '-'}</td>
            <td>${pmName}</td>
            <td>${budgetText}</td>
            <td>${progressText}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
            <td style="text-align:right">
              <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:12px" data-edit-project="${p.id}">Edit</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('[data-edit-project]').forEach(btn => {
        btn.addEventListener('click', () => {
           navigate(`/admin/edit-project?edit=${btn.dataset.editProject}`);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;padding:20px">Error: ${err.message}</td></tr>`;
    }
  };

  loadProjects();
  return undefined;
}

function initExpenseEntry(root, showToast, navigate) {
  const form = root.querySelector('#expenseEntryForm');
  if (!form) return undefined;

  const projectSelect = root.querySelector('#expenseProject');
  const phaseSelect = root.querySelector('#expensePhase');

  if (projectSelect) {
    apiFetch('/v1/projects', {}, navigate).then(projects => {
      if (!projects || !Array.isArray(projects)) return;
      projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        projectSelect.appendChild(opt);
      });
    });

    const onProjectChange = async () => {
      if (!phaseSelect) return;
      const pid = projectSelect.value;
      phaseSelect.innerHTML = '<option value="">No specific phase</option>';
      if (!pid) return;
      try {
        const phases = await apiFetch(`/v1/phases/project/${pid}`, {}, navigate);
        if (phases && Array.isArray(phases)) {
          phases.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id; opt.textContent = p.name;
            phaseSelect.appendChild(opt);
          });
        }
      } catch (e) {
        console.error('Failed to load phases:', e);
      }
    };
    projectSelect.addEventListener('change', onProjectChange);
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn ? btn.innerHTML : '';
    
    const pid = projectSelect ? projectSelect.value : '';
    if (!pid) {
      showToast('Please select a project', 'danger');
      return;
    }

    const phaseId = phaseSelect ? phaseSelect.value : '';
    const invoice = root.querySelector('#expInvoice')?.value?.trim() || '';

    const payload = {
      title: root.querySelector('#expTitle')?.value?.trim() || 'Untitled Expense',
      description: invoice ? `Invoice: ${invoice}` : null,
      amount: parseFloat(root.querySelector('#expAmount')?.value || '0'),
      expense_date: root.querySelector('#expDate')?.value || (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(),
      category: root.querySelector('#expCategory')?.value || 'Miscellaneous',
      project_id: pid,
      phase_id: phaseId || null,
      vendor: root.querySelector('#expVendor')?.value?.trim() || 'Generic Vendor',
      currency: 'INR'
    };

    if (btn) {
      btn.innerHTML = '<span class="spinner"></span> Saving...';
      btn.disabled = true;
    }

    try {
      await apiFetch('/v1/expenses', { method: 'POST', body: JSON.stringify(payload) }, navigate);
      showToast('Expense logged successfully!', 'success');
      form.reset();
      if (root.querySelector('#expDate')) {
        const d = new Date();
        root.querySelector('#expDate').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }
    } catch (err) {
      showToast(err.message || 'Failed to log expense', 'danger');
    } finally {
      if (btn) {
        btn.innerHTML = orig;
        btn.disabled = false;
      }
    }
  };

  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}

// ─────────────────────────────────────────────────────────────────────────────
// PM: Expense List
// ─────────────────────────────────────────────────────────────────────────────
function initExpenseList(root, showToast, navigate) {
  // expense-list.html uses #expenseProjectSelect and #expenseTable tbody
  const projectSelect = root.querySelector('#adminExpenseSelect') || root.querySelector('#expenseProjectSelect') || root.querySelector('#expenseListProject') || root.querySelector('[data-expense-project]');
  const tbody = root.querySelector('#expenseTableBody') || root.querySelector('#expenseTable tbody') || root.querySelector('[data-expense-table] tbody') || root.querySelector('.task-table tbody');
  const tfoot = root.querySelector('#expenseSummaryFoot');
  if (!tbody) return undefined;

  const formatDate = (d) => { if (!d) return '—'; const dt = new Date(d); if (isNaN(dt.getTime())) return '—'; return `${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleDateString('en-GB',{month:'short'})} ${dt.getFullYear()}`; };

  const emptyState = root.querySelector('#expenseEmptyState');
  const contentPanel = root.querySelector('#expenseContent');

  const loadExpenses = async (projectId) => {
    if (!projectId) {
      if (contentPanel) contentPanel.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">Select a project to view expenses</td></tr>';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }
    if (contentPanel) contentPanel.style.display = 'none';
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'Loading expenses...';
    }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">Loading expenses…</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    try {
      const expenses = await apiFetch(`/v1/expenses/project/${projectId}`, {}, navigate);
      if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">No expenses found.</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      let totalAmount = 0;
      const table = root.querySelector('#expenseTable') || root.querySelector('.task-table') || root.querySelector('table');
      const headers = table ? Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase()) : [];
      
      expenses.forEach(exp => {
        totalAmount += Number(exp.amount || 0);
        const tr = document.createElement('tr');
        const st = (exp.status || 'pending').toLowerCase();
        const statusClass = st === 'approved' ? 'active' : st === 'rejected' ? 'overdue' : 'pending';
        const badgeColorClass = st === 'approved' ? 'badge-success' : st === 'rejected' ? 'badge-danger' : 'badge-warning';

        let rowHtml = '';
        headers.forEach(h => {
          if (h.includes('date')) {
            rowHtml += `<td>${formatDate(exp.expense_date)}</td>`;
          } else if (h.includes('description') || h.includes('title')) {
            rowHtml += `<td><strong>${exp.title || '—'}</strong><div style="font-size:12px;color:var(--text-muted)">${exp.description || ''}</div></td>`;
          } else if (h.includes('category')) {
            rowHtml += `<td><span class="category-badge">${exp.category || '—'}</span></td>`;
          } else if (h.includes('amount')) {
            rowHtml += `<td>₹${Number(exp.amount || 0).toLocaleString('en-IN')}</td>`;
          } else if (h.includes('entered') || h.includes('submitter')) {
            rowHtml += `<td>${exp.submitter_name || '—'}${exp.vendor ? `<div style="font-size:11px;color:var(--text-muted)">Vendor: ${exp.vendor}</div>` : ''}</td>`;
          } else if (h.includes('vendor')) {
            rowHtml += `<td>${exp.vendor || '—'}</td>`;
          } else if (h.includes('status')) {
            rowHtml += `<td><span class="status-badge ${statusClass}">${exp.status.toUpperCase()}</span></td>`;
          } else if (h.includes('action')) {
            rowHtml += `
              <td>
                <div style="display:flex;gap:4px;">
                  <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" data-approve-expense="${exp.id}" ${st === 'approved' ? 'disabled' : ''}>Approve</button>
                  <button class="btn btn-danger" style="padding:4px 8px;font-size:11px;color:white;border:none;border-radius:4px;cursor:pointer" data-delete-expense="${exp.id}">Delete</button>
                </div>
              </td>`;
          } else {
            rowHtml += `<td>—</td>`;
          }
        });
        
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
      });
      const totalAmountEl = root.querySelector('#expenseTotalAmount') || root.querySelector('#expenseSummaryFoot');
      if (totalAmountEl) {
        if (totalAmountEl.tagName === 'TD' || totalAmountEl.tagName === 'SPAN') {
          totalAmountEl.innerHTML = `<strong>₹${totalAmount.toLocaleString('en-IN')}</strong>`;
        } else {
          totalAmountEl.innerHTML = `<tr><td colspan="3" style="text-align:right"><strong>Total:</strong></td><td colspan="4"><strong>₹${totalAmount.toLocaleString('en-IN')}</strong></td></tr>`;
        }
      }

      tbody.querySelectorAll('[data-approve-expense]').forEach(btn => {
        btn.addEventListener('click', () => {
          confirmAction({
            title: 'Approve Expense?',
            message: 'Are you sure you want to approve this expense?',
            confirmText: 'Yes, Approve',
            icon: 'check_circle',
            onConfirm: async () => {
              try {
                await apiFetch(`/v1/expenses/${btn.dataset.approveExpense}`, { 
                  method: 'PATCH', 
                  body: JSON.stringify({ status: 'approved' }) 
                }, navigate);
                showToast('Expense approved', 'success');
                loadExpenses(projectId);
              } catch (err) { showToast(err.message || 'Failed to approve', 'danger'); }
            }
          });
        });
      });

      tbody.querySelectorAll('[data-delete-expense]').forEach(btn => {
        btn.addEventListener('click', () => {
          confirmAction({
            title: 'Delete Expense?',
            message: 'Are you sure you want to delete this expense record?',
            confirmText: 'Yes, Delete',
            icon: 'payments',
            onConfirm: async () => {
              try {
                await apiFetch(`/v1/expenses/${btn.dataset.deleteExpense}`, { method: 'DELETE' }, navigate);
                showToast('Expense deleted', 'success');
                loadExpenses(projectId);
              } catch (err) { showToast(err.message || 'Failed to delete', 'danger'); }
            }
          });
        });
      });
      if (emptyState) emptyState.style.display = 'none';
      if (contentPanel) contentPanel.style.display = 'block';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;padding:24px">Failed: ${err.message}</td></tr>`;
      if (emptyState) emptyState.textContent = 'Failed to load expenses.';
    }
  };

  if (projectSelect) {
    apiFetch('/v1/projects', {}, navigate).then(projects => {
      if (!projects || !Array.isArray(projects)) return;
      projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
      projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
    });
    const onChange = () => loadExpenses(projectSelect.value);
    projectSelect.addEventListener('change', onChange);
    return () => projectSelect.removeEventListener('change', onChange);
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// PM: Material Master
// ─────────────────────────────────────────────────────────────────────────────
function initMaterialMaster(root, showToast, navigate) {
  const form = root.querySelector('#materialForm') || root.querySelector('[data-material-form]');
  const projectSelect = root.querySelector('#materialProjectSelect');
  const tbody = root.querySelector('#materialTableBody');
  const addBtn = root.querySelector('#addMaterialBtn');
  const addFormContainer = root.querySelector('#addMaterialForm');

  if (!form || !projectSelect) return undefined;

  const loadMaterials = async () => {
    const pid = projectSelect.value;
    if (!pid || !tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">Loading materials...</td></tr>';
    try {
      const materials = await apiFetch(`/v1/materials/project/${pid}`, {}, navigate);
      if (materials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px">No materials found.</td></tr>';
        return;
      }
      tbody.innerHTML = materials.map(m => `
        <tr>
          <td><strong>${m.name}</strong></td>
          <td>${m.unit}</td>
          <td>${Number(m.total_required_qty || 0).toFixed(2)}</td>
          <td>${Number(m.total_received || 0).toFixed(2)}</td>
          <td>${Number(m.remaining_stock || 0).toFixed(2)}</td>
          <td>₹${Number(m.unit_cost || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;padding:24px">Error: ${err.message}</td></tr>`;
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    if (!projects || !Array.isArray(projects)) return;
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
  });

  projectSelect.addEventListener('change', loadMaterials);

  if (addBtn && addFormContainer) {
    addBtn.addEventListener('click', () => {
      const isHidden = addFormContainer.style.display === 'none' || !addFormContainer.style.display;
      addFormContainer.style.display = isHidden ? 'block' : 'none';
    });
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!projectSelect.value) { showToast('Select a project', 'warning'); return; }
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn?.innerHTML;
    if (btn) { btn.innerHTML = 'Saving…'; btn.disabled = true; }
    const reqQtyStr = root.querySelector('#matRequiredQty')?.value;
    const payload = {
      project_id: projectSelect.value,
      name: root.querySelector('#matName')?.value.trim(),
      unit: root.querySelector('#matUnit')?.value.trim(),
      unit_cost: parseFloat(root.querySelector('#matCost')?.value || '0'),
      total_required_qty: reqQtyStr ? parseFloat(reqQtyStr) : null,
    };
    try {
      await apiFetch('/v1/materials', { method: 'POST', body: JSON.stringify(payload) }, navigate);
      showToast('Material added!', 'success');
      form.reset();
      if (addFormContainer) addFormContainer.style.display = 'none';
      loadMaterials();
    } catch (err) {
      showToast(err.message || 'Failed to add material', 'danger');
    } finally {
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }
  };

  form.addEventListener('submit', onSubmit);
  return () => {
    projectSelect.removeEventListener('change', loadMaterials);
    form.removeEventListener('submit', onSubmit);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PM: Material Stock Entry
// ─────────────────────────────────────────────────────────────────────────────
function initMaterialStock(root, showToast, navigate) {
  const projectSelect = root.querySelector('#stockProjectSelect');
  const materialSelect = root.querySelector('#materialSelect');
  const form = root.querySelector('#materialStockForm');
  if (!form || !projectSelect) return undefined;

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    if (!projects || !Array.isArray(projects)) return;
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
  });

  const onProjectChange = async () => {
    if (!materialSelect) return;
    const pid = projectSelect.value;
    if (!pid) {
      materialSelect.innerHTML = '<option value="">-- Select Project First --</option>';
      return;
    }
    materialSelect.innerHTML = '<option value="">Loading materials...</option>';
    try {
      const materials = await apiFetch(`/v1/materials/project/${pid}`, {}, navigate);
      materialSelect.innerHTML = '<option value="">-- Select Material --</option>';
      materials.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        const reqQty = m.total_required_qty != null ? Number(m.total_required_qty).toFixed(2) : 'N/A';
        opt.textContent = `${m.name} (Current Stock: ${Number(m.remaining_stock || 0).toFixed(2)} ${m.unit}, Required: ${reqQty} ${m.unit})`;
        materialSelect.appendChild(opt);
      });
    } catch (err) {
      materialSelect.innerHTML = '<option value="">-- Failed to load materials --</option>';
    }
  };

  projectSelect.addEventListener('change', onProjectChange);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!materialSelect?.value) { showToast('Select a material', 'warning'); return; }
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn?.innerHTML;
    if (btn) { btn.innerHTML = 'Saving…'; btn.disabled = true; }
    try {
      await apiFetch('/v1/material-stock', {
        method: 'POST',
        body: JSON.stringify({
          material_id: materialSelect.value,
          quantity: parseFloat(root.querySelector('#stockQty')?.value || '0'),
          received_date: root.querySelector('#stockDate')?.value || (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(),
          supplier: root.querySelector('#stockSupplier')?.value || 'Unknown',
          notes: root.querySelector('#stockNotes')?.value || null
        })
      }, navigate);
      showToast('Stock entry saved!', 'success');
      form.reset();
      onProjectChange(); // Refresh stock labels
    } catch (err) {
      showToast(err.message || 'Failed to save stock entry', 'danger');
    } finally {
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }
  };
  form.addEventListener('submit', onSubmit);
  return () => {
    projectSelect.removeEventListener('change', onProjectChange);
    form.removeEventListener('submit', onSubmit);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PM: Material Report
// ─────────────────────────────────────────────────────────────────────────────
function initMaterialReport(root, showToast, navigate) {
  // material-report.html uses #reportProjectSelect and #reportTable tbody
  const projectSelect = root.querySelector('#reportProjectSelect') || root.querySelector('#materialReportProject') || root.querySelector('[data-material-project]');
  const tbody = root.querySelector('#reportTable tbody') || root.querySelector('[data-material-table] tbody') || root.querySelector('.task-table tbody');
  const tfoot = root.querySelector('#reportSummaryFoot');
  if (!tbody) return undefined;

  const loadReport = async (projectId) => {
    if (!projectId) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px">Select a project to view report</td></tr>';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px">Loading report…</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    try {
      const reportData = await apiFetch(`/v1/material-usage/report/project/${projectId}`, {}, navigate);
      if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px">No material data for this project.</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      let totalCost = 0;
      reportData.forEach(item => {
        totalCost += Number(item.cost_incurred || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${item.material_name}</strong></td>
          <td>${item.unit || '—'}</td>
          <td>${Number(item.total_received || 0).toFixed(2)}</td>
          <td>${Number(item.total_used || 0).toFixed(2)}</td>
          <td>₹${Number(item.cost_incurred || 0).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(tr);
      });
      if (tfoot) tfoot.innerHTML = `<tr><td colspan="4" style="text-align:right"><strong>Total Cost:</strong></td><td><strong>₹${(totalCost/100000).toFixed(2)} Lakh</strong></td></tr>`;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;padding:24px">Failed: ${err.message}</td></tr>`;
    }
  };

  if (projectSelect) {
    apiFetch('/v1/projects', {}, navigate).then(projects => {
      if (!projects || !Array.isArray(projects)) return;
      projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
      projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
    });
    const onChange = () => loadReport(projectSelect.value);
    projectSelect.addEventListener('change', onChange);
    return () => projectSelect.removeEventListener('change', onChange);
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// PM: Photo Upload
// ─────────────────────────────────────────────────────────────────────────────
function initPhotoUpload(root, showToast, navigate) {
  const form = root.querySelector('#photoUploadForm');
  if (!form) return undefined;

  const projectSelect = root.querySelector('#photoProject');
  const phaseSelect = root.querySelector('#photoPhase');
  const fileInput = root.querySelector('#photoFile');
  const previewContainer = root.querySelector('#imagePreviewContainer');
  const placeholder = root.querySelector('#uploadPlaceholder');
  const imagePreview = root.querySelector('#imagePreview');
  const fileNameDisplay = root.querySelector('#fileNameDisplay');
  const uploadBtn = root.querySelector('#uploadBtn');

  if (projectSelect) {
    apiFetch('/v1/projects', {}, navigate).then(projects => {
      if (!projects || !Array.isArray(projects)) return;
      projectSelect.innerHTML = '<option value="">Select Project</option>';
      projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
    });
    projectSelect.addEventListener('change', async () => {
      if (phaseSelect) phaseSelect.innerHTML = '<option value="">Select Phase (Optional)</option>';
      if (!projectSelect.value || !phaseSelect) return;
      try {
        const phases = await apiFetch(`/v1/phases/project/${projectSelect.value}`, {}, navigate);
        if (phases && Array.isArray(phases)) {
          phases.forEach(ph => { const opt = document.createElement('option'); opt.value = ph.id; opt.textContent = ph.name; phaseSelect.appendChild(opt); });
        }
      } catch (err) { console.error('Phase load failed:', err); }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file && imagePreview) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          imagePreview.src = ev.target.result;
          if (fileNameDisplay) fileNameDisplay.textContent = file.name;
          if (placeholder) placeholder.style.display = 'none';
          if (previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    const file = fileInput?.files[0];
    if (!file) { showToast('Please select a photo', 'warning'); return; }
    if (!projectSelect?.value) { showToast('Please select a project', 'warning'); return; }
    const origHtml = uploadBtn?.innerHTML;
    if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.innerHTML = 'Uploading…'; }
    const auth = JSON.parse(localStorage.getItem('am_auth') || '{}');
    const formData = new FormData();
    formData.append('project_id', projectSelect.value);
    if (phaseSelect?.value) formData.append('phase_id', phaseSelect.value);
    formData.append('category', root.querySelector('#photoCategory')?.value || 'general');
    formData.append('caption', root.querySelector('#photoCaption')?.value || '');
    formData.append('file', file);
    try {
      const res = await fetch(`/api/v1/projects/${projectSelect.value}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.access_token}` },
        body: formData
      });
      if (res.ok) {
        showToast('Photo uploaded!', 'success');
        form.reset();
        if (imagePreview) imagePreview.src = '';
        if (placeholder) placeholder.style.display = 'block';
        if (previewContainer) previewContainer.style.display = 'none';
        if (phaseSelect) phaseSelect.innerHTML = '<option value="">Select Phase (Optional)</option>';
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Upload failed', 'danger');
      }
    } catch (err) {
      showToast('Failed to upload photo', 'danger');
    } finally {
      if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.innerHTML = origHtml; }
    }
  };
  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}

// ─────────────────────────────────────────────────────────────────────────────
// PM: Photo Gallery
// ─────────────────────────────────────────────────────────────────────────────
function initPhotoGallery(root, showToast, navigate, role = 'admin') {
  const projectSelect = root.querySelector('#galleryProject') || root.querySelector('#galleryProjectFilter') || root.querySelector('[data-gallery-project]');
  const userSelect = root.querySelector('#galleryUserFilter');
  const dateFilter = root.querySelector('#galleryDateFilter');
  const categoryBtns = root.querySelectorAll('.filter-btn');
  const gallery = root.querySelector('#photoGallery') || root.querySelector('#photoGalleryGrid') || root.querySelector('[data-photo-gallery]');
  const emptyState = root.querySelector('#galleryEmptyState');
  
  if (!gallery) return undefined;

  let allPhotos = [];
  let currentCategory = 'all';

  let lightbox = document.getElementById('photoLightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'photoLightbox';
    lightbox.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.9); z-index: 10000; display: none;
      align-items: center; justify-content: center; cursor: pointer;
    `;
    lightbox.innerHTML = `
      <span class="material-symbols-outlined" style="position:absolute; top:20px; right:20px; color:white; font-size:40px;">close</span>
      <img id="lightboxImg" src="" style="max-width:90%; max-height:90%; box-shadow: 0 0 30px rgba(0,0,0,0.5); border-radius:4px; object-fit:contain;">
      <div id="lightboxCaption" style="position:absolute; bottom:20px; left:0; width:100%; text-align:center; color:white; font-size:1.2rem; padding: 0 20px;"></div>
    `;
    document.body.appendChild(lightbox);
    lightbox.addEventListener('click', () => { lightbox.style.display = 'none'; });
  }
  const lightboxImg = lightbox.querySelector('#lightboxImg');
  const lightboxCaption = lightbox.querySelector('#lightboxCaption');

  const openLightbox = (url, caption) => {
    lightboxImg.src = url;
    lightboxCaption.textContent = caption || '';
    lightbox.style.display = 'flex';
  };

  const renderPhotos = () => {
    const pId = projectSelect ? projectSelect.value : '';
    const uId = userSelect ? userSelect.value : '';
    const dateVal = dateFilter ? dateFilter.value : '';
    
    let filtered = allPhotos;
    
    if (pId) filtered = filtered.filter(p => String(p.project_id) === pId);
    if (uId) filtered = filtered.filter(p => String(p.uploaded_by_id) === uId);
    if (dateVal) {
      const selectedDate = new Date(dateVal).toDateString();
      filtered = filtered.filter(p => p.created_at && new Date(p.created_at).toDateString() === selectedDate);
    }
    if (currentCategory !== 'all') {
      if (currentCategory === 'general') {
        filtered = filtered.filter(p => (p.category || 'General').toLowerCase() === 'general');
      } else if (currentCategory === 'project') {
        filtered = filtered.filter(p => p.project_id);
      } else {
        filtered = filtered.filter(p => (p.category || '').toLowerCase() === currentCategory);
      }
    }

    if (filtered.length === 0) {
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'No photos match your filters.';
      }
      gallery.innerHTML = '';
      gallery.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    gallery.style.display = 'grid';
    gallery.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    gallery.style.gap = '20px';

    gallery.innerHTML = filtered.map(photo => {
      const dateStr = photo.created_at ? formatDate(photo.created_at) : '';
      const cat = (photo.category || 'General').toLowerCase();
      let badgeColor = 'var(--primary)';
      if (cat === 'progress') badgeColor = 'var(--info)';
      if (cat === 'issue') badgeColor = 'var(--danger)';
      if (cat === 'completion') badgeColor = 'var(--success)';
      const imgUrl = photo.file_url;
      return `
        <div class="photo-card panel" style="padding:0; overflow:hidden; border:1px solid var(--border); background:var(--bg); border-radius:var(--radius); position:relative; cursor:pointer;">
          <div style="height:200px; background:#111; position:relative;" class="img-container" data-url="${imgUrl}" data-caption="${photo.caption || ''}">
            <img src="${imgUrl}" alt="${photo.caption || 'Site photo'}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.src='https://via.placeholder.com/400x300?text=Image+Not+Found';">
            <span style="position:absolute; top:12px; left:12px; background:${badgeColor}; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold; text-transform:uppercase;">
              ${photo.category || 'General'}
            </span>
            ${(role === 'admin' || role === 'pm') ? `
            <button data-delete-photo="${photo.id}" style="position:absolute; top:12px; right:12px; background:var(--danger); color:#fff; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0.8; z-index:10;">
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>` : ''}
          </div>
          <div style="padding:16px;" class="info-container" data-url="${imgUrl}" data-caption="${photo.caption || ''}">
            <p style="margin:0 0 8px 0; font-size:0.95rem; color:var(--text);">${photo.caption || 'No caption provided'}</p>
            <div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:0.8rem;">
              <span>${dateStr}</span>
              <span>By: ${photo.uploaded_by_name || 'Unknown'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    gallery.querySelectorAll('.img-container, .info-container').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete-photo]')) return;
        openLightbox(el.dataset.url, el.dataset.caption);
      });
    });

    gallery.querySelectorAll('[data-delete-photo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmAction({
          title: 'Delete Photo?',
          message: 'Are you sure you want to delete this photo?',
          confirmText: 'Yes, Delete Photo',
          icon: 'photo_library',
          onConfirm: async () => {
            try {
              await apiFetch(`/v1/site-photos/${btn.dataset.deletePhoto}`, { method: 'DELETE' }, navigate);
              showToast('Photo deleted', 'success');
              allPhotos = allPhotos.filter(p => String(p.id) !== String(btn.dataset.deletePhoto));
              renderPhotos();
            } catch (err) {
              showToast(err.message || 'Failed to delete photo', 'danger');
            }
          }
        });
      });
    });
  };

  const loadPhotos = async () => {
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'Loading photos...';
    }
    gallery.innerHTML = '';
    gallery.style.display = 'none';
    
    try {
      allPhotos = await apiFetch('/v1/site-photos?limit=200', {}, navigate).catch(() => []);
      
      if (userSelect && allPhotos.length > 0) {
        const usersMap = {};
        allPhotos.forEach(p => {
          if (p.uploaded_by_id && p.uploaded_by_name) usersMap[p.uploaded_by_id] = p.uploaded_by_name;
        });
        userSelect.innerHTML = '<option value="">All Users</option>';
        Object.keys(usersMap).forEach(uid => {
          const opt = document.createElement('option');
          opt.value = uid;
          opt.textContent = usersMap[uid];
          userSelect.appendChild(opt);
        });
      }
      
      renderPhotos();
    } catch (err) {
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = `Error: ${err.message}`;
      }
    }
  };

  if (projectSelect) {
    apiFetch('/v1/projects', {}, navigate).then(projects => {
      if (!projects || !Array.isArray(projects)) return;
      
      if (role === 'se') {
        apiFetch('/v1/tasks/assigned', {}, navigate).then(tasks => {
          const assignedProjectIds = new Set(tasks.map(t => t.project_id));
          const filteredProjects = projects.filter(p => assignedProjectIds.has(p.id));
          projectSelect.innerHTML = '<option value="">All Projects</option>';
          filteredProjects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
        }).catch(err => console.error(err));
      } else {
        projectSelect.innerHTML = '<option value="">All Projects</option>';
        projects.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; projectSelect.appendChild(opt); });
      }
    });
    projectSelect.addEventListener('change', renderPhotos);
  }
  
  if (userSelect) userSelect.addEventListener('change', renderPhotos);
  if (dateFilter) dateFilter.addEventListener('change', renderPhotos);
  
  if (categoryBtns && categoryBtns.length > 0) {
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryBtns.forEach(b => {
          b.className = 'btn filter-btn';
          b.style.background = 'var(--bg)';
          b.style.border = '1px solid var(--border)';
          b.style.color = 'var(--text)';
        });
        btn.className = 'btn btn-primary filter-btn';
        btn.style.background = '';
        btn.style.border = '';
        btn.style.color = '';
        currentCategory = btn.dataset.cat || 'all';
        renderPhotos();
      });
    });
  }

  loadPhotos();
  
  return () => {
    if (projectSelect) projectSelect.removeEventListener('change', renderPhotos);
    if (userSelect) userSelect.removeEventListener('change', renderPhotos);
    if (dateFilter) dateFilter.removeEventListener('change', renderPhotos);
  };
}

function initCreateProject(root, showToast, navigate) {
  const form = root.querySelector('[data-project-form]');
  if (!form) return undefined;

  const pmSelect = root.querySelector('#projectManager');
  const clientSelect = root.querySelector('#projectClient');
  const seDropdown = root.querySelector('[data-engineer-options]');
  const tags = root.querySelector('[data-engineer-tags]');
  const search = root.querySelector('[data-engineer-search]');
  const clearButton = root.querySelector('[data-clear-engineers]');
  const summary = root.querySelector('[data-selection-count]');

  const renderPicker = () => {
    const checkboxes = Array.from(seDropdown.querySelectorAll('input[type="checkbox"]'));
    const selected = checkboxes.filter(cb => cb.checked);
    tags.innerHTML = '';
    if (!selected.length) {
      tags.innerHTML = '<span class="engineer-picker-placeholder">No site engineers selected yet.</span>';
    } else {
      selected.forEach(cb => {
        const chip = document.createElement('span');
        chip.className = 'engineer-tag';
        chip.innerHTML = `<span>${cb.dataset.name}</span><button type="button" aria-label="Remove">×</button>`;
        chip.querySelector('button').addEventListener('click', () => { cb.checked = false; renderPicker(); });
        tags.appendChild(chip);
      });
    }
    checkboxes.forEach(cb => {
      const option = cb.closest('.engineer-option');
      if (option) option.classList.toggle('is-selected', cb.checked);
    });
    if (summary) summary.textContent = `${selected.length} engineer${selected.length === 1 ? '' : 's'} selected`;
  };

  const filterPicker = () => {
    const query = search.value.trim().toLowerCase();
    const checkboxes = Array.from(seDropdown.querySelectorAll('input[type="checkbox"]'));
    checkboxes.forEach(cb => {
      const option = cb.closest('.engineer-option');
      const matches = !query || (option && option.textContent.toLowerCase().includes(query));
      if (option) option.classList.toggle('is-hidden', !matches);
    });
  };

  apiFetch('/v1/users', {}, navigate).then(users => {
    const pms = users.filter(u => u.role === 'project_manager');
    const clients = users.filter(u => u.role === 'client');
    const engineers = users.filter(u => u.role === 'site_engineer');

    if (pmSelect) {
      pmSelect.innerHTML = '<option value="">Select project manager</option>';
      pms.forEach(pm => {
        const opt = document.createElement('option');
        opt.value = pm.id;
        opt.textContent = pm.full_name;
        pmSelect.appendChild(opt);
      });
    }

    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">Select client</option>';
      clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.full_name;
        clientSelect.appendChild(opt);
      });
    }

    if (seDropdown) {
      seDropdown.innerHTML = engineers.map(se => `
        <label class="engineer-option">
          <input type="checkbox" value="${se.id}" data-name="${se.full_name}">
          <span><strong>${se.full_name}</strong><small>${se.role.replace('_', ' ').toUpperCase()}</small></span>
        </label>
      `).join('');
      seDropdown.querySelectorAll('input').forEach(i => i.addEventListener('change', renderPicker));
    }
  });

  if (search) search.addEventListener('input', filterPicker);
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      search.value = '';
      seDropdown.querySelectorAll('input').forEach(cb => cb.checked = false);
      filterPicker();
      renderPicker();
    });
  }

  const onFormSubmit = async (e) => {
    e.preventDefault();
    const name = root.querySelector('#projectName').value.trim();
    const pmId = root.querySelector('#projectManager').value;
    if (!name || !pmId) {
      showToast('Project Name and Manager are required', 'warning');
      return;
    }

    const btn = form.querySelector('[data-create-project-submit]');
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Creating...';

    try {
      const payload = {
        name,
        description: root.querySelector('#projectDescription').value.trim() || null,
        location: root.querySelector('#projectLocation').value.trim() || null,
        status: 'planning',
        start_date: root.querySelector('#projectStartDate').value || null,
        end_date: root.querySelector('#projectEndDate').value || null,
        budget: parseFloat(root.querySelector('#projectBudget').value.replace(/,/g, '')) || null,
        manager_id: pmId
      };

      const project = await apiFetch('/v1/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, navigate);

      const assignments = [{ user_id: pmId, role: 'project_manager' }];
      const clientId = root.querySelector('#projectClient').value;
      if (clientId) assignments.push({ user_id: clientId, role: 'client' });
      const seIds = Array.from(seDropdown.querySelectorAll('input:checked')).map(i => i.value);
      seIds.forEach(id => assignments.push({ user_id: id, role: 'site_engineer' }));

      await Promise.allSettled(assignments.map(a =>
        apiFetch(`/v1/projects/${project.id}/assignments`, {
          method: 'POST',
          body: JSON.stringify(a)
        }, navigate)
      ));

      showToast('Project created successfully!', 'success');
      setTimeout(() => navigate('/admin/project-list'), 1500);
    } catch (err) {
      showToast(err.message, 'danger');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  };

  form.addEventListener('submit', onFormSubmit);
  return () => form.removeEventListener('submit', onFormSubmit);
}

function initCheckIn(root, showToast, navigate) {
  const checkInBtn = root.querySelector('.btn-primary');
  const checkOutBtn = root.querySelector('.btn-outline');
  const checkedInLabel = root.querySelector('.panel p[style*="var(--success)"]');
  if (!checkInBtn || !checkOutBtn) return undefined;

  let currentProjectId = null;
  const user = JSON.parse(localStorage.getItem('am_auth') || '{}');

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    if (!projects || projects.length === 0) return;
    const proj = projects.find(p => p.status === 'active') || projects[0];
    currentProjectId = proj.id;

    apiFetch(`/v1/attendance/project/${currentProjectId}`, {}, navigate).then(records => {
      const d = new Date();
      const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const todayAttendance = records.find(r => r.user_id === user.id && r.attendance_date === todayStr);

      if (todayAttendance) {
        checkInBtn.disabled = true;
        const checkInTime = new Date(todayAttendance.check_in).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
        if (checkedInLabel) {
          checkedInLabel.textContent = `✓ Checked in at ${checkInTime}`;
          checkedInLabel.style.display = 'block';
        }
        if (todayAttendance.check_out) {
          checkOutBtn.disabled = true;
          checkOutBtn.innerHTML = '<span class="material-symbols-outlined">done_all</span> Checked Out';
        } else {
          checkOutBtn.disabled = false;
        }
      } else {
        if (checkedInLabel) checkedInLabel.style.display = 'none';
        checkOutBtn.disabled = true;
      }
    });
  });

  const onCheckIn = async () => {
    if (!currentProjectId) return;
    try {
      checkInBtn.disabled = true;
      const res = await apiFetch('/v1/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ project_id: currentProjectId, notes: "" })
      }, navigate);
      const checkInTime = new Date(res.check_in).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
      if (checkedInLabel) {
        checkedInLabel.textContent = `✓ Checked in at ${checkInTime}`;
        checkedInLabel.style.display = 'block';
      }
      checkInBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Checked In';
      checkOutBtn.disabled = false;
      showToast('Checked in successfully', 'success');
    } catch (err) {
      showToast(err.message, 'danger');
      checkInBtn.disabled = false;
    }
  };

  const onCheckOut = async () => {
    if (!currentProjectId) return;
    try {
      checkOutBtn.disabled = true;
      await apiFetch('/v1/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ project_id: currentProjectId, notes: "" })
      }, navigate);
      checkOutBtn.innerHTML = '<span class="material-symbols-outlined">exit_to_app</span> Checked Out';
      showToast('Checked out successfully', 'success');
    } catch (err) {
      showToast(err.message, 'danger');
      checkOutBtn.disabled = false;
    }
  };

  checkInBtn.addEventListener('click', onCheckIn);
  checkOutBtn.addEventListener('click', onCheckOut);
  return () => {
    checkInBtn.removeEventListener('click', onCheckIn);
    checkOutBtn.removeEventListener('click', onCheckOut);
  };
}

function initMaterialUsage(root, showToast, navigate) {
  const projectSelect = root.querySelector('#usageProjectSelect');
  const materialSelect = root.querySelector('#usageMaterial');
  const taskSelect = root.querySelector('#usageTask');
  const form = root.querySelector('#materialUsageForm');
  const dateInput = root.querySelector('#usageDate');

  if (!projectSelect || !form) return undefined;
  if (dateInput) {
    const d = new Date();
    dateInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  Promise.all([
    apiFetch('/v1/projects', {}, navigate),
    apiFetch('/v1/tasks/assigned', {}, navigate)
  ]).then(([projects, tasks]) => {
    // Collect all project IDs from the assigned tasks
    // Fallback to fetching phase if project_id is somehow missing, but backend sets it.
    const assignedProjectIds = new Set(tasks.map(t => t.project_id));
    
    // Only show projects where the user has at least one assigned task
    const filteredProjects = projects.filter(p => assignedProjectIds.has(p.id));
    
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    filteredProjects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });
  }).catch(err => console.error('Failed to load projects for material usage', err));

  const loadProjectData = async () => {
    const pid = projectSelect.value;
    if (!pid) {
      materialSelect.innerHTML = '<option value="">-- Select Project First --</option>';
      taskSelect.innerHTML = '<option value="">-- Select Task --</option>';
      return;
    }
    try {
      const [materials, phases] = await Promise.all([
        apiFetch(`/v1/materials/project/${pid}`, {}, navigate),
        apiFetch(`/v1/phases/project/${pid}`, {}, navigate)
      ]);
      materialSelect.innerHTML = '<option value="">-- Select Material --</option>';
      materials.forEach(mat => {
        const opt = document.createElement('option');
        opt.value = mat.id;
        opt.textContent = `${mat.name} (Available: ${Number(mat.remaining_stock).toFixed(2)} ${mat.unit})`;
        materialSelect.appendChild(opt);
      });
      taskSelect.innerHTML = '<option value="">-- Select Task --</option>';
      if (phases && phases.length > 0) {
        const tasks = await apiFetch(`/v1/tasks/phase/${phases[0].id}`, {}, navigate);
        tasks.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id; opt.textContent = t.name;
          taskSelect.appendChild(opt);
        });
      }
    } catch (err) { console.error('Usage init failed:', err); }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      material_id: materialSelect.value,
      quantity_used: parseFloat(root.querySelector('#usageQuantity').value),
      usage_date: dateInput.value,
      notes: root.querySelector('#usageNotes').value || null,
      task_id: taskSelect.value || null
    };
    try {
      await apiFetch('/v1/material-usage', { method: 'POST', body: JSON.stringify(payload) }, navigate);
      showToast('Usage logged', 'success');
      form.reset();
      if (dateInput) {
        const d = new Date();
        dateInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }
      loadProjectData();
    } catch (err) { showToast(err.message, 'danger'); }
  };

  projectSelect.addEventListener('change', loadProjectData);
  form.addEventListener('submit', onSubmit);
  return () => {
    projectSelect.removeEventListener('change', loadProjectData);
    form.removeEventListener('submit', onSubmit);
  };
}

function initPerformance(root, showToast, navigate) {
  const projectSelect = root.querySelector('#perfProjectSelect');
  const perfContent = root.querySelector('#perfContent');
  const emptyState = root.querySelector('#perfEmptyState');
  
  if (!projectSelect) return undefined;

  const auth = JSON.parse(localStorage.getItem('am_auth') || '{}');
  const user = auth;

  const loadPerformanceData = async (projectId) => {
    try {
      if (perfContent) perfContent.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'Loading performance metrics...';
      }

      const [userTasks, attendanceData] = await Promise.all([
        apiFetch(`/v1/tasks/assigned?project_id=${projectId}`, {}, navigate),
        apiFetch(`/v1/attendance/project/${projectId}`, {}, navigate)
      ]);

      const userId = user.id || user.user_id || (user.user ? user.user.id : null);
      
      const userAttendance = attendanceData.filter(a => {
        const uId = a.user_id || (a.user ? a.user.id : null);
        if (!uId || !userId) return false;
        return String(uId).toLowerCase() === String(userId).toLowerCase();
      });

      // Task Completion
      const totalAssigned = userTasks.length;
      const completedTasks = userTasks.filter(t => t.status === 'completed').length;
      const completionRate = totalAssigned > 0 ? (completedTasks / totalAssigned) * 100 : 0;
      
      // On-Time Completion 
      let onTimeCount = 0;
      userTasks.forEach(t => {
         if (t.status === 'completed') {
             const due = t.due_date ? new Date(t.due_date) : null;
             const completed = t.completed_date ? new Date(t.completed_date) : null;
             if (due && completed && completed <= due) onTimeCount++;
             else if (!due) onTimeCount++;
         }
      });
      const onTimeRate = completedTasks > 0 ? (onTimeCount / completedTasks) * 100 : 0;

      // Attendance
      const totalWorkingDays = 30; 
      const uniqueDays = new Set(userAttendance.map(a => a.attendance_date)).size;
      const attendanceRate = Math.min((uniqueDays / totalWorkingDays) * 100, 100);

      // Hours
      const totalHours = userAttendance.reduce((sum, r) => sum + (parseFloat(r.total_hours) || 0), 0);

      // Update DOM
      const setVal = (id, val) => { const el = root.querySelector('#' + id); if (el) el.textContent = val; };
      setVal('valTaskRate', Math.round(completionRate) + '%');
      setVal('valOnTime', Math.round(onTimeRate) + '%');
      setVal('valAttendanceRate', Math.round(attendanceRate) + '%');
      setVal('valTotalHours', totalHours.toFixed(1) + 'h');

      setVal('lblTaskBar', `${completedTasks} / ${totalAssigned}`);
      const barTask = root.querySelector('#barTaskRate');
      if (barTask) barTask.style.width = completionRate + '%';

      setVal('lblOnTimeBar', `${onTimeCount} / ${completedTasks}`);
      const barOnTime = root.querySelector('#barOnTime');
      if (barOnTime) barOnTime.style.width = onTimeRate + '%';

      setVal('lblAttendanceBar', `${uniqueDays} / ${totalWorkingDays}`);
      const barAtt = root.querySelector('#barAttendance');
      if (barAtt) barAtt.style.width = attendanceRate + '%';

      // Chart
      const canvas = root.querySelector('#performanceChart');
      if (canvas && window.Chart) {
        const existingChart = window.Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new window.Chart(canvas.getContext('2d'), {
          type: 'radar',
          data: {
            labels: ['Task Completion', 'On-Time Speed', 'Attendance', 'Work Intensity', 'Overall Efficiency'],
            datasets: [{
              label: 'Performance Score',
              data: [
                completionRate, 
                onTimeRate, 
                attendanceRate, 
                Math.min((totalHours / 160) * 100, 100),
                (completionRate + onTimeRate + attendanceRate) / 3
              ],
              backgroundColor: 'rgba(52, 152, 219, 0.2)',
              borderColor: 'rgba(52, 152, 219, 1)',
              pointBackgroundColor: 'rgba(52, 152, 219, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(52, 152, 219, 1)',
              borderWidth: 3,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              r: {
                angleLines: { color: 'rgba(0,0,0,0.05)' },
                grid: { color: 'rgba(0,0,0,0.05)' },
                pointLabels: {
                  font: { size: 12, weight: '600', family: "'Inter', sans-serif" },
                  color: '#64748b'
                },
                beginAtZero: true,
                max: 100,
                ticks: { display: false, stepSize: 20 }
              }
            },
            plugins: {
               legend: { display: false },
               tooltip: {
                 backgroundColor: '#1e293b',
                 titleFont: { size: 13 },
                 bodyFont: { size: 13 },
                 padding: 12,
                 cornerRadius: 8,
                 displayColors: false
               }
            }
          }
        });
      }

      if (emptyState) emptyState.style.display = 'none';
      if (perfContent) perfContent.style.display = 'block';

    } catch (err) {
      console.error(err);
      showToast('Failed to load metrics', 'danger');
      if (emptyState) emptyState.textContent = 'Error loading performance metrics.';
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">Select a Project</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });

    const savedProjectId = sessionStorage.getItem('am_se_perf_project');
    const projectExists = projects.some(p => p.id === savedProjectId);

    if (projectExists) {
      projectSelect.value = savedProjectId;
      loadPerformanceData(savedProjectId);
    } else if (projects.length > 0) {
      // Find project with most tasks to avoid showing 0/0 by default
      apiFetch('/v1/tasks/assigned', {}, navigate).then(allTasks => {
        const counts = {};
        allTasks.forEach(t => {
          const pid = t.project_id;
          if (pid) counts[pid] = (counts[pid] || 0) + 1;
        });
        
        let bestPid = projects[0].id;
        let maxCount = -1;
        projects.forEach(p => {
          if ((counts[p.id] || 0) > maxCount) {
            maxCount = counts[p.id] || 0;
            bestPid = p.id;
          }
        });
        
        projectSelect.value = bestPid;
        loadPerformanceData(bestPid);
      }).catch(() => {
        projectSelect.value = projects[0].id;
        loadPerformanceData(projects[0].id);
      });
    }
  });

  const onSelectChange = (e) => {
    const pid = e.target.value;
    if (pid) {
      sessionStorage.setItem('am_se_perf_project', pid);
      loadPerformanceData(pid);
    } else {
      if (perfContent) perfContent.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'Select a project to view performance metrics.';
      }
    }
  };
  projectSelect.addEventListener('change', onSelectChange);

  return () => projectSelect.removeEventListener('change', onSelectChange);
}

function initAttendanceHistory(root, showToast, navigate) {
  return initAttendanceView(root, showToast, navigate);
}

function initProjectProgress(root, showToast, navigate) {
  const projectSelect = root.querySelector('#clientProjectSelect');
  const content = root.querySelector('#clientProgressContent');
  const emptyState = root.querySelector('#clientProgressEmptyState');
  
  if (!projectSelect || !content) {
    // Fallback to analytics page if it's not the client progress page
    return initAnalyticsPage(root, showToast, navigate);
  }

  const loadProgress = async (projectId) => {
    if (!projectId) {
      content.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'Select a project to view detailed progress.';
      }
      return;
    }

    try {
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'Loading progress...';
      }
      content.style.display = 'none';

      const [overviews, ganttData] = await Promise.all([
        apiFetch('/v1/analytics/overview', {}, navigate),
        apiFetch(`/v1/analytics/gantt?project_id=${projectId}`, {}, navigate)
      ]);

      const overview = overviews.find(o => String(o.project_id) === String(projectId));
      if (overview) {
        const pct = Math.round(overview.progress_pct || 0);
        const valOverall = root.querySelector('#valOverallProgress');
        const barOverall = root.querySelector('#barOverallProgress');
        if (valOverall) valOverall.textContent = pct + '%';
        if (barOverall) barOverall.style.width = pct + '%';

        const ts = overview.task_stats || { total: 0, completed: 0, in_progress: 0, not_started: 0, delayed: 0 };
        const setStat = (id, label, val) => {
          const el = root.querySelector('#' + id);
          if (el) el.textContent = label + ': ' + val;
        };
        setStat('lblCompleted', 'Completed', ts.completed);
        setStat('lblInProgress', 'In Progress', ts.in_progress);
        setStat('lblNotStarted', 'Not Started', ts.not_started);
        setStat('lblDelayed', 'Delayed', ts.delayed);

        const t = ts.total > 0 ? ts.total : 1;
        const setBar = (id, val) => {
          const el = root.querySelector('#' + id);
          if (el) el.style.width = ((val / t) * 100) + '%';
        };
        setBar('barCompleted', ts.completed);
        setBar('barInProgress', ts.in_progress);
        setBar('barNotStarted', ts.not_started);
        setBar('barDelayed', ts.delayed);
      }

      const phasesContainer = root.querySelector('#phasesContainer');
      if (phasesContainer) {
        phasesContainer.innerHTML = '';
        const tasks = ganttData.tasks || [];
        if (tasks.length > 0) {
          const tasksByPhase = {};
          tasks.forEach(task => {
            const pName = task.phase_name || 'Unassigned Phase';
            if (!tasksByPhase[pName]) tasksByPhase[pName] = [];
            tasksByPhase[pName].push(task);
          });

          for (const [phase, phaseTasks] of Object.entries(tasksByPhase)) {
            const phasePanel = document.createElement('div');
            phasePanel.className = 'panel animate-in';
            phasePanel.style.marginBottom = '20px';
            
            let tasksHtml = phaseTasks.map(task => {
              let badgeClass = 'pending';
              const status = (task.status || '').toLowerCase().replace(/_/g, ' ');
              if (status === 'completed') badgeClass = 'progress';
              else if (status === 'delayed') badgeClass = 'overdue';
              else if (status === 'in_progress') badgeClass = 'active';

              return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border);">
                  <div>
                    <div style="font-weight:600; color:var(--text);">${task.name}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">${task.start_date ? formatDate(task.start_date) : '-'} to ${task.due_date ? formatDate(task.due_date) : '-'}</div>
                  </div>
                  <div><span class="status-badge ${badgeClass}">${task.status}</span></div>
                </div>
              `;
            }).join('');

            phasePanel.innerHTML = `
              <div class="panel-header"><span class="panel-title">${phase}</span></div>
              <div class="panel-body" style="padding:0">
                ${tasksHtml}
              </div>
            `;
            phasesContainer.appendChild(phasePanel);
          }
        } else {
          phasesContainer.innerHTML = '<div class="panel"><div class="panel-body" style="text-align:center;color:var(--text-muted)">No tasks found for this project.</div></div>';
        }
      }

      if (emptyState) emptyState.style.display = 'none';
      content.style.display = 'block';

    } catch (err) {
      console.error(err);
      showToast('Failed to load project progress', 'danger');
      if (emptyState) emptyState.textContent = 'Error loading project progress.';
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">Select a Project</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });

    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      const selectPanel = projectSelect.closest('.panel');
      if (selectPanel) selectPanel.style.display = 'none';
      loadProgress(projects[0].id);
    }
  });

  const onChange = (e) => loadProgress(e.target.value);
  projectSelect.addEventListener('change', onChange);
  return () => projectSelect.removeEventListener('change', onChange);
}

function initPhaseProgress(root, showToast, navigate) {
  const projectSelect = root.querySelector('#clientPhaseSelect') || root.querySelector('#projectSelect');
  const content = root.querySelector('#clientPhaseContent') || root.querySelector('.dash-content');
  if (!projectSelect || !content) return undefined;

  const loadPhases = async (projectId) => {
    if (!projectId) {
      content.innerHTML = '<div class="panel animate-in"><div class="panel-body" style="text-align:center;padding:40px 20px;color:var(--text-muted);">Select a project to view phase progress</div></div>';
      return;
    }

    try {
      content.innerHTML = '<div class="panel animate-in"><div class="panel-body" style="text-align:center;padding:40px 20px;color:var(--text-muted);">Loading phases...</div></div>';

      const phases = await apiFetch(`/v1/phases/project/${projectId}`, {}, navigate);
      phases.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      if (phases.length === 0) {
        content.innerHTML = '<div class="panel animate-in"><div class="panel-body" style="text-align:center;padding:40px 20px;color:var(--text-muted);">No phases defined for this project.</div></div>';
        return;
      }

      // Fetch tasks for each phase to calculate progress
      const phaseResults = await Promise.all(
        phases.map(async (phase) => {
          try {
            const tasks = await apiFetch(`/v1/tasks/phase/${phase.id}`, {}, navigate);
            const total = tasks.length;
            const completed = tasks.filter(t => t.status === 'completed' || t.status === 'Completed').length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return { phase, pct };
          } catch (e) {
            console.error('Failed tasks for phase', phase.id, e);
            return { phase, pct: 0 };
          }
        })
      );

      content.innerHTML = '';

      phaseResults.forEach(({ phase, pct }) => {
        let badgeClass = 'pending';
        const status = (phase.status || '').toLowerCase();
        if (status === 'completed') badgeClass = 'progress';
        else if (status === 'delayed' || status === 'overdue') badgeClass = 'overdue';
        else if (status === 'active' || status === 'in_progress') badgeClass = 'active';

        let fillClass = pct === 100 ? ' green' : (pct > 0 ? ' blue' : '');
        
        const start = phase.start_date ? formatDate(phase.start_date) : '--';
        const end = phase.end_date ? formatDate(phase.end_date) : '--';

        const cardHtml = `
          <div class="panel animate-in" style="margin-bottom: 16px;">
            <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <span class="panel-title">${phase.name}</span>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px; font-weight:normal;">Timeline: ${start} to ${end}</div>
              </div>
              <span class="status-badge ${badgeClass}">${phase.status || 'Planned'}</span>
            </div>
            <div class="panel-body">
              <div class="progress-bar-wrapper" style="margin-bottom:0">
                <div class="progress-label"><span>Phase Progress</span><span>${pct}%</span></div>
                <div class="progress-track"><div class="progress-fill${fillClass}" style="width:${pct}%"></div></div>
              </div>
            </div>
          </div>
        `;
        content.insertAdjacentHTML('beforeend', cardHtml);
      });

    } catch (err) {
      console.error(err);
      showToast('Failed to load phase progress', 'danger');
      content.innerHTML = '<div class="panel animate-in"><div class="panel-body" style="text-align:center;padding:40px 20px;color:var(--text-muted);">Error loading phase progress.</div></div>';
    }
  };

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">Select a Project</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });

    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      const selectPanel = projectSelect.closest('.panel');
      if (selectPanel) selectPanel.style.display = 'none';
      loadPhases(projects[0].id);
    }
  });

  const onChange = (e) => loadPhases(e.target.value);
  projectSelect.addEventListener('change', onChange);
  return () => projectSelect.removeEventListener('change', onChange);
}

function initManagePhases(root, showToast, navigate) {
  const projectSelect = root.querySelector('#phaseProjectSelect');
  const tbody = root.querySelector('[data-pm-phase-table] tbody');

  if (!projectSelect || !tbody) return;

  const formatDate = (d) => { if (!d) return '—'; const dt = new Date(d); if (isNaN(dt.getTime())) return '—'; return `${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleDateString('en-GB',{month:'short'})} ${dt.getFullYear()}`; };

  const statusBadge = (s) => {
    const cls = s === 'completed' ? 'active' : s === 'in_progress' ? 'progress' : 'pending';
    return `<span class="status-badge ${cls}">${s || 'planned'}</span>`;
  };

  const loadPhases = async (projectId) => {
    if (!projectId) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px">Select a project to view phases</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px">Loading phases…</td></tr>';
    try {
      const phases = await apiFetch(`/v1/phases/project/${projectId}`, {}, navigate);
      if (!phases || phases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">No phases found.</td></tr>';
        return;
      }
      tbody.innerHTML = '';
      phases.forEach(phase => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${phase.name}</strong></td>
          <td>${formatDate(phase.start_date)}</td>
          <td>${formatDate(phase.end_date)}</td>
          <td>${statusBadge(phase.status)}</td>
          <td style="text-align:right">
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button class="btn btn-sm btn-outline" data-view-phase="${phase.id}" style="padding:6px 16px; border-radius:4px; font-weight:600;">View</button>
              <button class="btn btn-sm btn-primary" data-edit-phase="${phase.id}" style="padding:6px 16px; border-radius:4px; font-weight:600; color:white;">Edit</button>
            </div>
          </td>`;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('[data-view-phase]').forEach(btn => {
        btn.addEventListener('click', () => {
          navigate(`/pm/view-phase?id=${btn.dataset.viewPhase}`);
        });
      });

      tbody.querySelectorAll('[data-edit-phase]').forEach(btn => {
        btn.addEventListener('click', () => {
          navigate(`/pm/edit-phase?id=${btn.dataset.editPhase}`);
        });
      });


    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:red">Error: ${err.message}</td></tr>`;
    }
  };

  const onProjectChange = (e) => {
    const pid = e.target.value;
    if (pid) {
      sessionStorage.setItem('pmManagePhasesProjectId', pid);
    } else {
      sessionStorage.removeItem('pmManagePhasesProjectId');
    }
    loadPhases(pid);
  };
  projectSelect.addEventListener('change', onProjectChange);

  const savedPid = sessionStorage.getItem('pmManagePhasesProjectId');

  apiFetch('/v1/projects', {}, navigate).then(projects => {
    projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
    if (!projects || projects.length === 0) {
      showToast('No projects found.', 'warning');
      return;
    }
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });
    
    if (savedPid) {
      projectSelect.value = savedPid;
      if (projectSelect.value === savedPid) { // Option exists
        loadPhases(savedPid);
        return;
      }
    }
    
    if (projects.length === 1) {
      projectSelect.value = projects[0].id;
      loadPhases(projects[0].id);
    }
  }).catch(err => {
    showToast('Failed to load projects: ' + err.message, 'danger');
  });

  return () => projectSelect.removeEventListener('change', onProjectChange);
}



  function initViewPhase(root, showToast, navigate, id) {
    if (!id) {
      console.warn('[initViewPhase] No ID provided');
      return undefined;
    }
    const content = root.querySelector('#viewPhaseContent');
    if (!content) {
      console.warn('[initViewPhase] #viewPhaseContent not found');
      return undefined;
    }

    (async () => {
      try {
        const phase = await apiFetch(`/v1/phases/${id}`, {}, navigate);
      if (phase) {
        content.innerHTML = `
          <div class="panel animate-in" style="max-width: 800px; margin: 0 auto;">
            <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
              <span class="panel-title">${phase.name}</span>
              <span class="status-badge ${phase.status === 'completed' ? 'active' : 'progress'}">${phase.status || 'Planning'}</span>
            </div>
            <div class="panel-body">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; padding: 16px 0;">
                <div>
                  <label style="color:var(--text-muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:8px;">Project Details</label>
                  <p style="font-size:16px; font-weight:600; color:var(--text);">${phase.project_name || 'N/A'}</p>
                </div>
                <div>
                  <label style="color:var(--text-muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:8px;">Timeline</label>
                  <p style="font-size:15px; font-weight:500;">${formatDate(phase.start_date)} — ${formatDate(phase.end_date)}</p>
                </div>
              </div>

              <div style="margin-bottom:32px;">
                <label style="color:var(--text-muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:12px;">Phase Description</label>
                <div style="font-size:15px; line-height:1.6; color:var(--text); background: white; padding:20px; border-radius:8px; border:1px solid var(--border); min-height:100px;">
                  ${phase.description || '<span style="color:var(--text-muted)">No description provided for this phase.</span>'}
                </div>
              </div>
              
              <div style="margin-top:40px; padding-top:24px; border-top:1px solid var(--border); display:flex; gap:12px; justify-content: flex-end;">
                <button class="btn btn-outline" data-back-btn style="min-width:120px">Back</button>
                <button class="btn btn-primary" data-edit-btn style="min-width:120px">Edit Phase</button>
              </div>
            </div>
          </div>
        `;

        content.querySelector('[data-back-btn]')?.addEventListener('click', () => window.history.back());
        content.querySelector('[data-edit-btn]')?.addEventListener('click', () => navigate(`/pm/edit-phase?id=${id}`));
      }
      } catch (err) { showToast(err.message, 'danger'); }
    })();
    return undefined;
  }

  function initEditPhase(root, showToast, navigate, id) {
    if (!id) return undefined;
    (async () => {
      try {
        const phase = await apiFetch(`/v1/phases/${id}`, {}, navigate);
      if (phase) {
        const idInput = root.querySelector('#editPhaseId');
        const nameInput = root.querySelector('#editPhaseName');
        const startInput = root.querySelector('#editPhaseStart');
        const endInput = root.querySelector('#editPhaseEnd');
        const statusInput = root.querySelector('#editPhaseStatus');
        const descInput = root.querySelector('#editPhaseDesc');

        if (idInput) idInput.value = phase.id;
        if (nameInput) nameInput.value = phase.name;
        if (startInput) startInput.value = phase.start_date ? phase.start_date.split('T')[0] : '';
        if (endInput) endInput.value = phase.end_date ? phase.end_date.split('T')[0] : '';
        if (statusInput) statusInput.value = phase.status || 'planning';
        if (descInput) descInput.value = phase.description || '';
      }

      root.querySelector('#editPhasePageForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: root.querySelector('#editPhaseName').value,
          start_date: root.querySelector('#editPhaseStart').value,
          end_date: root.querySelector('#editPhaseEnd').value,
          status: root.querySelector('#editPhaseStatus')?.value,
          description: root.querySelector('#editPhaseDesc')?.value
        };
        try {
          await apiFetch(`/v1/phases/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, navigate);
          showToast('Phase updated successfully!', 'success');
          navigate('/pm/manage-phases');
        } catch (err) { showToast(err.message, 'danger'); }
      });

      root.querySelector('#deletePhasePageBtn')?.addEventListener('click', () => {
        confirmAction({
          title: 'Delete Phase?',
          message: 'Are you sure you want to delete this phase?',
          subMessage: 'All associated tasks will also be deleted.',
          confirmText: 'Yes, Delete Phase',
          icon: 'account_tree',
          onConfirm: async () => {
            try {
              await apiFetch(`/v1/phases/${id}`, { method: 'DELETE' }, navigate);
              showToast('Phase deleted.', 'success');
              navigate('/pm/manage-phases');
            } catch (err) { showToast(err.message, 'danger'); }
          }
        });
      });
    } catch (err) { showToast(err.message, 'danger'); }
    })();
    return undefined;
  }

  function initViewTask(root, showToast, navigate, id) {
    if (!id) {
      console.warn('[initViewTask] No ID provided');
      return undefined;
    }
    const content = root.querySelector('#viewTaskPageContent');
    if (!content) {
      console.warn('[initViewTask] #viewTaskPageContent not found');
      return undefined;
    }

    (async () => {
      try {
        const task = await apiFetch(`/v1/tasks/${id}`, {}, navigate);
      if (task) {
        content.innerHTML = `
          <div class="panel animate-in" style="max-width: 900px; margin: 0 auto;">
            <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
              <span class="panel-title">${task.name}</span>
              <div style="display:flex; gap:8px;">
                <span class="status-badge ${['high', 'critical'].includes(task.priority) ? 'overdue' : 'pending'}">${(task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1)} Priority</span>
                <span class="status-badge ${task.status === 'completed' ? 'active' : 'progress'}">${(task.status || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
            </div>
            <div class="panel-body">
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:32px; margin-bottom:32px; background: var(--bg); padding: 24px; border-radius: 12px; border: 1px solid var(--border);">
                <div>
                  <label style="color:var(--text-muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">Timeline</label>
                  <p style="font-size:14px; font-weight:500;">${formatDate(task.start_date)} — ${formatDate(task.due_date)}</p>
                </div>
                <div>
                  <label style="color:var(--text-muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">Assignee</label>
                  <p style="font-size:14px; font-weight:600;">${task.assigned_to_name || 'Unassigned'}</p>
                </div>
                <div>
                  <label style="color:var(--text-muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">Phase</label>
                  <p style="font-size:14px; font-weight:500;">${task.phase_name || 'N/A'}</p>
                </div>
              </div>
              
              <div style="margin-bottom:32px;">
                <label style="color:var(--text-muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:12px;">Task Description</label>
                <div style="font-size:15px; line-height:1.6; color:var(--text); background: white; padding:20px; border-radius:8px; border:1px solid var(--border); min-height:100px;">
                  ${task.description || '<span style="color:var(--text-muted)">No description provided for this task.</span>'}
                </div>
              </div>

              <div style="display:flex; gap:12px; justify-content: flex-end; padding-top:24px; border-top:1px solid var(--border);">
                <button class="btn btn-outline" data-back-btn style="min-width:120px">Back</button>
                <button class="btn btn-primary" data-edit-btn style="min-width:120px">Edit Task</button>
              </div>
            </div>
          </div>
        `;

        content.querySelector('[data-back-btn]')?.addEventListener('click', () => window.history.back());
        content.querySelector('[data-edit-btn]')?.addEventListener('click', () => navigate(`/pm/edit-task?id=${id}`));
      }
    } catch (err) {
      showToast(err.message, 'danger');
      content.innerHTML = `<div style="text-align:center; padding:50px; color:var(--danger)">Error: ${err.message}</div>`;
    }
    })();
    return undefined;
  }

  function initEditTask(root, showToast, navigate, id) {
    if (!id) return undefined;
    (async () => {
      try {
        const task = await apiFetch(`/v1/tasks/${id}`, {}, navigate);
      const phase = await apiFetch(`/v1/phases/${task.phase_id}`, {}, navigate);
      const team = await apiFetch(`/v1/projects/${phase.project_id}/assignments`, {}, navigate);
      console.log(`[initEditTask] Task ${id} Project Team:`, team);
      
      const siteEngineers = (team || []).filter(m => {
        const r = (m.role || '').toLowerCase().replace('_', ' ');
        return r === 'site engineer' || r === 'site_engineer';
      });
      
      const assignSel = root.querySelector('#editTaskAssigned');
      if (assignSel) {
        assignSel.innerHTML = '<option value="">Unassigned</option>' + 
          siteEngineers.map(u => `<option value="${u.user_id}" ${String(u.user_id) === String(task.assigned_to) ? 'selected' : ''}>${u.full_name || 'Unnamed Engineer'}</option>`).join('');
      }

      if (task) {
        const idInput = root.querySelector('#editTaskId');
        const nameInput = root.querySelector('#editTaskName');
        const statusInput = root.querySelector('#editTaskStatus');
        const priorityInput = root.querySelector('#editTaskPriority');
        const startInput = root.querySelector('#editTaskStart');
        const dueInput = root.querySelector('#editTaskDue');
        const descInput = root.querySelector('#editTaskDesc');

        if (idInput) idInput.value = task.id;
        if (nameInput) nameInput.value = task.name;
        if (statusInput) statusInput.value = task.status || 'not_started';
        if (priorityInput) priorityInput.value = task.priority || 'medium';
        if (startInput) startInput.value = task.start_date ? task.start_date.split('T')[0] : '';
        if (dueInput) dueInput.value = task.due_date ? task.due_date.split('T')[0] : '';
        if (descInput) descInput.value = task.description || '';
      }

      root.querySelector('#editTaskPageForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: root.querySelector('#editTaskName').value,
          status: root.querySelector('#editTaskStatus').value,
          priority: root.querySelector('#editTaskPriority').value,
          assigned_to: root.querySelector('#editTaskAssigned').value || null,
          start_date: root.querySelector('#editTaskStart').value,
          due_date: root.querySelector('#editTaskDue').value,
          description: root.querySelector('#editTaskDesc').value
        };
        try {
          await apiFetch(`/v1/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, navigate);
          showToast('Task updated successfully!', 'success');
          navigate('/pm/manage-tasks');
        } catch (err) { showToast(err.message, 'danger'); }
      });

      root.querySelector('#deleteTaskPageBtn')?.addEventListener('click', () => {
        confirmAction({
          title: 'Delete Task?',
          message: 'Are you sure you want to delete this task?',
          subMessage: 'This action cannot be undone.',
          confirmText: 'Yes, Delete Task',
          icon: 'assignment',
          onConfirm: async () => {
            try {
              await apiFetch(`/v1/tasks/${id}`, { method: 'DELETE' }, navigate);
              showToast('Task deleted.', 'success');
              navigate('/pm/manage-tasks');
            } catch (err) { showToast(err.message, 'danger'); }
          }
        });
      });
    } catch (err) { showToast(err.message, 'danger'); }
    })();
    return undefined;
  }
