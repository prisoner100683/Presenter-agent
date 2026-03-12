"use strict";

const state = {
  profiles: [],
  selectedProfileId: ""
};

const elements = {
  profileSelect: document.getElementById("profile-select"),
  nickname: document.getElementById("profile-nickname"),
  baseUrl: document.getElementById("profile-base-url"),
  model: document.getElementById("profile-model"),
  apiKey: document.getElementById("profile-api-key"),
  profileHint: document.getElementById("profile-hint"),
  resetProfile: document.getElementById("reset-profile"),
  saveProfile: document.getElementById("save-profile"),
  deleteProfile: document.getElementById("delete-profile"),
  projectName: document.getElementById("job-project-name"),
  scenario: document.getElementById("job-scenario"),
  audience: document.getElementById("job-audience"),
  style: document.getElementById("job-style"),
  stack: document.getElementById("job-stack"),
  fileInput: document.getElementById("job-file"),
  uploadDetail: document.getElementById("upload-detail"),
  runJob: document.getElementById("run-job"),
  jobStatus: document.getElementById("job-status"),
  jobResult: document.getElementById("job-result"),
  previewLink: document.getElementById("preview-link"),
  resultMeta: document.getElementById("result-meta")
};

function setStatus(message, isError = false) {
  elements.jobStatus.textContent = message;
  elements.jobStatus.style.color = isError ? "#982f11" : "";
}

function setProfileHint(message, isError = false) {
  elements.profileHint.textContent = message;
  elements.profileHint.style.color = isError ? "#982f11" : "";
}

function clearProfileForm() {
  state.selectedProfileId = "";
  elements.profileSelect.value = "";
  elements.nickname.value = "";
  elements.baseUrl.value = "";
  elements.model.value = "";
  elements.apiKey.value = "";
  setProfileHint("新建配置时会把 API key 保存在当前仓库的 `.local/automation/` 中。");
}

function renderProfiles() {
  elements.profileSelect.innerHTML = '<option value="">请选择</option>';
  state.profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.nickname} · ${profile.model}`;
    elements.profileSelect.appendChild(option);
  });
  elements.profileSelect.value = state.selectedProfileId;
}

function applyProfile(profileId) {
  state.selectedProfileId = profileId;
  const profile = state.profiles.find((entry) => entry.id === profileId);
  if (!profile) {
    clearProfileForm();
    return;
  }

  elements.nickname.value = profile.nickname;
  elements.baseUrl.value = profile.baseUrl;
  elements.model.value = profile.model;
  elements.apiKey.value = "";
  setProfileHint(`当前配置已保存。密钥仅显示掩码：${profile.apiKeyMasked}`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function loadProfiles() {
  const payload = await fetchJson("/api/profiles");
  state.profiles = payload.profiles;
  renderProfiles();
  if (state.profiles.length) {
    applyProfile(state.profiles[0].id);
    elements.profileSelect.value = state.profiles[0].id;
  } else {
    clearProfileForm();
  }
}

async function saveProfile() {
  const body = {
    id: state.selectedProfileId || undefined,
    nickname: elements.nickname.value,
    baseUrl: elements.baseUrl.value,
    model: elements.model.value,
    apiKey: elements.apiKey.value
  };

  const payload = await fetchJson("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  state.profiles = payload.profiles;
  state.selectedProfileId = payload.profile.id;
  renderProfiles();
  elements.profileSelect.value = payload.profile.id;
  setProfileHint(`已保存配置：${payload.profile.nickname}`);
  elements.apiKey.value = "";
}

async function deleteProfile() {
  if (!state.selectedProfileId) {
    setProfileHint("先选择一个已保存配置。", true);
    return;
  }

  const payload = await fetchJson(`/api/profiles/${encodeURIComponent(state.selectedProfileId)}`, {
    method: "DELETE"
  });

  state.profiles = payload.profiles;
  clearProfileForm();
  renderProfiles();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",").pop());
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runJob() {
  const file = elements.fileInput.files[0];
  if (!state.selectedProfileId) {
    setStatus("请先保存并选择一个模型配置。", true);
    return;
  }
  if (!file) {
    setStatus("请先选择一个 `.pptx` 文件。", true);
    return;
  }

  elements.runJob.disabled = true;
  elements.jobResult.hidden = true;
  setStatus("正在读取文件并提交生成任务……");

  try {
    const fileDataBase64 = await readFileAsBase64(file);
    setStatus("正在调用模型并构建静态网页，这一步可能需要几十秒。");

    const payload = await fetchJson("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: state.selectedProfileId,
        fileName: file.name,
        fileDataBase64,
        projectName: elements.projectName.value,
        scenario: elements.scenario.value,
        audience: elements.audience.value,
        style: elements.style.value,
        stack: elements.stack.value
      })
    });

    const result = payload.result;
    setStatus(`已完成：${result.projectSlug} ${result.versionName}。`);
    elements.previewLink.href = result.previewUrl;
    elements.previewLink.textContent = result.previewUrl;
    elements.resultMeta.textContent = `模式：${result.generationMode} · 幻灯片 ${result.slideCount} 页 · 资源 ${result.copiedAssets} 个`;
    elements.jobResult.hidden = false;
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    elements.runJob.disabled = false;
  }
}

elements.profileSelect.addEventListener("change", (event) => {
  applyProfile(event.target.value);
});

elements.fileInput.addEventListener("change", () => {
  const file = elements.fileInput.files[0];
  elements.uploadDetail.textContent = file ? `已选择：${file.name}` : "目前仅支持 `.pptx`。";
});

elements.resetProfile.addEventListener("click", clearProfileForm);
elements.saveProfile.addEventListener("click", () => saveProfile().catch((error) => setProfileHint(error.message, true)));
elements.deleteProfile.addEventListener("click", () => deleteProfile().catch((error) => setProfileHint(error.message, true)));
elements.runJob.addEventListener("click", runJob);

loadProfiles().catch((error) => {
  setProfileHint(error.message, true);
  setStatus("初始化失败。", true);
});
