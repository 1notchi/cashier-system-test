const Toast = (() => {
  const DISPLAY_DURATION = 3000;

  let toastTimer = null;
  let toastElement = null;

  /**
   * トースト用のDOM要素を取得する。
   * 存在しない場合は生成する。
   */
  function getToastElement() {
    if (toastElement) {
      return toastElement;
    }

    toastElement = document.createElement("div");
    toastElement.className = "toast";
    toastElement.setAttribute("aria-atomic", "true");

    document.body.appendChild(toastElement);

    return toastElement;
  }

  /**
   * トーストを表示する内部関数。
   *
   * @param {string} message 表示するメッセージ
   * @param {string} type トーストの種類
   */
  function show(message, type) {
    const toast = getToastElement();

    clearTimeout(toastTimer);

    // 前回の表示状態と種類を取り除く
    toast.classList.remove("show", "success", "error");

    // メッセージと種類を設定する
    toast.textContent = message;
    toast.classList.add(type);

    // 読み上げ方法を通知の種類によって変更する
    if (type === "error") {
      toast.setAttribute("role", "alert");
      toast.setAttribute("aria-live", "assertive");
    } else {
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
    }

    // 表示アニメーションを再実行する
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add("show");
      });
    });

    // 3秒後に非表示にする
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      toastTimer = null;
    }, DISPLAY_DURATION);
  }

  /**
   * 成功トーストを表示する。
   */
  function success(message) {
    show(message, "success");
  }

  /**
   * 失敗トーストを表示する。
   */
  function error(message) {
    show(message, "error");
  }

  return {
    success,
    error
  };
})();
