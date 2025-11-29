-- 修复安全警告：为函数设置 search_path
ALTER FUNCTION generate_activation_code() SET search_path = public;
ALTER FUNCTION set_activation_code() SET search_path = public;