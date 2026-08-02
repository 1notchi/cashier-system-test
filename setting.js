document.addEventListener("DOMContentLoaded", async () => {

  const profile = await getCurrentProfile();

  if (profile.role !== "admin") {
    location.href = "top.html";
    return;
  }

});
