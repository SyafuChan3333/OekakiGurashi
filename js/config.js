// 動作の切り替え。開発用ボタンは、URL に ?debug を付けたときだけ設定に出す。
export const DEBUG = new URLSearchParams(location.search).has('debug');
