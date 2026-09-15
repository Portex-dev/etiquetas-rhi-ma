(() => {
  "use strict";

  const AREAS = [
    { id: "m-10", name: "M-10", equipment: ["Exaustor Q-904", "Ventilador Q-902-1", "Ventilador Q-902-2", "Queimador F-901-x-1", "Queimador F-901-x-2"] },
    { id: "rk-1", name: "RK-1", equipment: ["Correia T-2302", "Correia T-2304", "Correia T-2306", "Correia T-2307"] }
  ];
  const config = window.APP_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const supabase = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const state = { records: [], deleteId: null, qrContext: null, turnstileToken: "", trashMode: false };

  function show(id) {
    $$(".view").forEach((view) => { view.hidden = view.id !== id; });
    $("#app").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function route() {
    const routeName = location.hash.replace(/^#\//, "").split("?")[0] || "registrar";
    $$('[data-nav]').forEach((link) => link.classList.toggle("active", link.dataset.nav === routeName));
    if (routeName === "admin") { show("admin-view"); loadAdmin(); return; }
    if (routeName === "qrcodes") { show("qr-view"); renderQrCodes(); return; }
    show("register-view"); applyQrContext();
  }

  function fillCatalog() {
    const areaSelect = $("#area-select");
    const filterArea = $('#filters-form [name="area"]');
    AREAS.forEach((area) => {
      areaSelect.add(new Option(`Área ${area.name}`, area.id));
      filterArea.add(new Option(area.name, area.id));
    });
    areaSelect.addEventListener("change", () => fillEquipment(areaSelect.value));
    filterArea.addEventListener("change", () => fillFilterEquipment(filterArea.value));
    fillFilterEquipment("");
  }

  function fillEquipment(areaId, selected = "") {
    const select = $("#equipment-select");
    select.innerHTML = "";
    const area = AREAS.find((item) => item.id === areaId);
    select.add(new Option(area ? "Selecione o equipamento" : "Selecione a área primeiro", ""));
    select.disabled = !area;
    area?.equipment.forEach((name) => select.add(new Option(name, name, false, name === selected)));
  }

  function fillFilterEquipment(areaId) {
    const select = $('#filters-form [name="equipment"]');
    select.innerHTML = '<option value="">Todos</option>';
    const areas = areaId ? AREAS.filter((area) => area.id === areaId) : AREAS;
    areas.flatMap((area) => area.equipment).forEach((name) => select.add(new Option(name, name)));
  }

  function applyQrContext() {
    const previousQrContext = state.qrContext;
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const areaId = params.get("area");
    const equipment = params.get("equipment");
    const area = AREAS.find((item) => item.id === areaId && item.equipment.includes(equipment));
    state.qrContext = area ? { areaId, equipment } : null;
    const locked = $("#locked-equipment");
    const selects = [$("#area-select").closest("label"), $("#equipment-select").closest("label")];
    if (state.qrContext) {
      $("#area-select").value = areaId;
      fillEquipment(areaId, equipment);
      selects.forEach((label) => { label.hidden = true; });
      locked.hidden = false;
      locked.textContent = `Área ${area.name} · ${equipment}`;
      $("#equipment-context").textContent = `Área ${area.name} · ${equipment}`;
    } else {
      if (previousQrContext) { $("#area-select").value = ""; fillEquipment(""); }
      selects.forEach((label) => { label.hidden = false; });
      locked.hidden = true;
      $("#equipment-context").textContent = "Selecione a área e o equipamento para começar.";
    }
  }

  async function compressImage(file) {
    if (!file) return null;
    if (file.size > 10 * 1024 * 1024) throw new Error("A foto original deve ter no máximo 10 MB.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = .84; let blob;
    do { blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)); quality -= .08; } while (blob.size > 1024 * 1024 && quality >= .52);
    return new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
  }

  async function submitRecord(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = $("#form-error"); error.hidden = true;
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.querySelector("span").textContent = "Registrando…";
    try {
      if (!configured) throw new Error("O serviço de dados ainda não foi conectado. Configure o Supabase antes de publicar.");
      const data = new FormData(form);
      if (state.qrContext) { data.set("area_id", state.qrContext.areaId); data.set("equipment_id", state.qrContext.equipment); }
      const photo = await compressImage($("#photo-input").files[0]);
      if (photo) data.set("photo", photo); else data.delete("photo");
      if (config.turnstileSiteKey) data.set("turnstile_token", state.turnstileToken);
      const response = await fetch(`${config.supabaseUrl}/functions/v1/create-label`, { method: "POST", headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` }, body: data });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Não foi possível registrar. Tente novamente."); }
      form.reset();
      show("success-view");
    } catch (err) { error.textContent = err.message; error.hidden = false; }
    finally { button.disabled = false; button.querySelector("span").textContent = "Registrar etiqueta"; }
  }

  async function loadAdmin() {
    if (!configured) { $("#login-error").textContent = "Conecte o Supabase no arquivo config.js para liberar o acesso."; $("#login-error").hidden = false; return; }
    const { data } = await supabase.auth.getSession();
    $("#login-panel").hidden = Boolean(data.session);
    $("#dashboard").hidden = !data.session;
    if (data.session) await loadRecords();
  }

  async function login(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const error = $("#login-error"); error.hidden = true;
    const { error: authError } = await supabase.auth.signInWithPassword({ email: data.get("email"), password: data.get("password") });
    if (authError) { error.textContent = "E-mail ou senha inválidos."; error.hidden = false; return; }
    loadAdmin();
  }

  async function loadRecords() {
    const formData = new FormData($("#filters-form"));
    let query = supabase.from("label_records").select("*").order("created_at", { ascending: false });
    query = state.trashMode ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
    for (const [field, value] of [["area_id", formData.get("area")], ["equipment_name", formData.get("equipment")], ["tag_type", formData.get("tag")], ["status", formData.get("status")]]) if (value) query = query.eq(field, value);
    if (formData.get("from")) query = query.gte("created_at", `${formData.get("from")}T00:00:00`);
    if (formData.get("to")) query = query.lte("created_at", `${formData.get("to")}T23:59:59`);
    $("#records-state").textContent = "Carregando registros…";
    const [{ data, error }, { count }, { data: sizes }] = await Promise.all([query, supabase.from("label_records").select("id", { count: "exact", head: true }).is("deleted_at", null), supabase.from("label_records").select("photo_size_bytes")]);
    if (error) { $("#records-state").textContent = "Não foi possível carregar os registros."; return; }
    state.records = data || [];
    $("#records-state").textContent = state.records.length ? "" : "Nenhum registro encontrado para estes filtros.";
    $("#new-count").textContent = state.records.filter((r) => r.status === "novo").length;
    $("#shown-count").textContent = state.records.length; $("#total-count").textContent = count ?? 0;
    const used = (sizes || []).reduce((sum, row) => sum + Number(row.photo_size_bytes || 0), 0);
    const alert = $("#storage-alert"); alert.hidden = used < 819 * 1024 * 1024;
    if (!alert.hidden) alert.textContent = `Atenção: as fotos já ocupam aproximadamente ${Math.round(used / 1024 / 1024)} MB do armazenamento gratuito.`;
    renderRecords();
  }

  function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value ?? ""; return node.innerHTML; }
  function renderRecords() {
    $("#records-list").innerHTML = state.records.map((r) => `<article class="record-card ${r.tag_type}"><div class="record-main"><div class="record-meta"><span class="status-pill">${r.status === "novo" ? "Novo" : "Visto"}</span><span>${new Date(r.created_at).toLocaleString("pt-BR")}</span><span>Área ${escapeHtml(r.area_id.toUpperCase())}</span></div><h3>${escapeHtml(r.equipment_name)}</h3><div class="record-meta"><span>${escapeHtml(r.collaborator_name)} · ${escapeHtml(r.registration_number)}</span><span>${escapeHtml(r.tag_type)}</span></div><p class="record-description">${escapeHtml(r.anomaly_description)}</p><p class="record-meta">Local: ${escapeHtml(r.location_description)}</p>${r.photo_path ? `<button class="text-button photo-button" data-photo="${escapeHtml(r.photo_path)}">Ver foto</button>` : ""}</div><div class="record-actions">${state.trashMode ? `<button class="secondary-button restore-button" data-id="${r.id}">Restaurar</button>` : `<button class="secondary-button status-button" data-id="${r.id}" data-status="${r.status}">${r.status === "novo" ? "Marcar como visto" : "Voltar para novo"}</button><button class="text-button delete-button" data-id="${r.id}">Excluir</button>`}</div></article>`).join("");
  }

  async function updateStatus(id, current) { await supabase.from("label_records").update({ status: current === "novo" ? "visto" : "novo" }).eq("id", id); loadRecords(); }
  async function trashRecord(id) { await supabase.from("label_records").update({ deleted_at: new Date().toISOString() }).eq("id", id); loadRecords(); }
  async function restoreRecord(id) { await supabase.from("label_records").update({ deleted_at: null }).eq("id", id); loadRecords(); }
  async function viewPhoto(path) { const { data, error } = await supabase.storage.from("label-photos").createSignedUrl(path, 60); if (!error) window.open(data.signedUrl, "_blank", "noopener"); }

  async function exportRecords() {
    if (!state.records.length) return;
    const rows = await Promise.all(state.records.map(async (r) => { let photoUrl = ""; if (r.photo_path) { const { data } = await supabase.storage.from("label-photos").createSignedUrl(r.photo_path, 86400); photoUrl = data?.signedUrl || ""; } return { Data: new Date(r.created_at).toLocaleString("pt-BR"), Estado: r.status === "novo" ? "Novo" : "Visto", Área: r.area_id.toUpperCase(), Equipamento: r.equipment_name, Etiqueta: r.tag_type, Colaborador: r.collaborator_name, Matrícula: r.registration_number, Anomalia: r.anomaly_description, Localização: r.location_description, Foto: photoUrl }; }));
    const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Registros"); XLSX.writeFile(book, `etiquetas-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function renderQrCodes() {
    const grid = $("#qr-grid"); grid.innerHTML = "";
    AREAS.forEach((area) => area.equipment.forEach((equipment) => {
      const card = document.createElement("article"); card.className = "qr-card";
      const canvas = document.createElement("canvas"); const url = `${config.publicSiteUrl || location.href.split("#")[0]}#/registrar?area=${encodeURIComponent(area.id)}&equipment=${encodeURIComponent(equipment)}`;
      card.append(canvas); card.insertAdjacentHTML("beforeend", `<h2>${escapeHtml(equipment)}</h2><p>Área ${escapeHtml(area.name)}</p>`); grid.append(card);
      if (window.QRCode) QRCode.toCanvas(canvas, url, { width: 220, margin: 2, color: { dark: "#073b4c", light: "#ffffff" } });
    }));
  }

  function initTurnstile() {
    if (!config.turnstileSiteKey) return;
    const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true;
    script.onload = () => window.turnstile.render("#turnstile-slot", { sitekey: config.turnstileSiteKey, callback: (token) => { state.turnstileToken = token; }, "error-callback": () => { state.turnstileToken = ""; } }); document.head.append(script);
  }

  fillCatalog(); initTurnstile();
  $("#label-form").addEventListener("submit", submitRecord);
  $("#photo-input").addEventListener("change", (e) => { $("#photo-feedback").textContent = e.target.files[0]?.name || "Tirar uma foto ou escolher da galeria"; });
  $("#new-record-button").addEventListener("click", () => { location.hash = state.qrContext ? `#/registrar?area=${encodeURIComponent(state.qrContext.areaId)}&equipment=${encodeURIComponent(state.qrContext.equipment)}` : "#/registrar"; });
  $("#login-form").addEventListener("submit", login);
  $("#logout-button").addEventListener("click", async () => { await supabase.auth.signOut(); loadAdmin(); });
  $("#filters-form").addEventListener("submit", (e) => { e.preventDefault(); loadRecords(); });
  $("#clear-filters").addEventListener("click", () => { $("#filters-form").reset(); fillFilterEquipment(""); loadRecords(); });
  $("#export-button").addEventListener("click", exportRecords);
  $("#records-list").addEventListener("click", (e) => { const status = e.target.closest(".status-button"); const del = e.target.closest(".delete-button"); const restore = e.target.closest(".restore-button"); const photo = e.target.closest(".photo-button"); if (status) updateStatus(status.dataset.id, status.dataset.status); if (del) { state.deleteId = del.dataset.id; $("#delete-dialog").showModal(); } if (restore) restoreRecord(restore.dataset.id); if (photo) viewPhoto(photo.dataset.photo); });
  $("#confirm-delete").addEventListener("click", () => { if (state.deleteId) trashRecord(state.deleteId); });
  $("#print-qrs").addEventListener("click", () => window.print());
  $("#trash-toggle").addEventListener("click", () => { state.trashMode = !state.trashMode; $("#trash-toggle").textContent = state.trashMode ? "Voltar aos registros" : "Ver lixeira"; $("#trash-notice").hidden = !state.trashMode; $("#filters-form").hidden = state.trashMode; loadRecords(); });
  window.addEventListener("hashchange", route); route();
})();
