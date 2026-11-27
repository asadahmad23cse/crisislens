<?php
/*
 |--------------------------------------------------------------------------
 | Application configuration
 |--------------------------------------------------------------------------
 | Change the DB_* values if your XAMPP MySQL uses a different user/password.
 */
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'admission_portal');

define('APP_NAME', 'EduAdmit');
define('PER_PAGE', 5);        // records per page in the admin list
define('COOKIE_DAYS', 30);    // lifetime of remember-me and interest cookies

// Throw exceptions on MySQL errors so we can handle them with try/catch
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ---- Session: secure cookie settings, then start ----
if (session_status() === PHP_SESSION_NONE) {
    session_name('EDUADMIT_SESSID');
    session_set_cookie_params([
        'lifetime' => 0,        // session cookie: removed when browser closes
        'path'     => '/',
        'httponly' => true,     // JavaScript cannot read the session id
        'samesite' => 'Lax',
    ]);
    session_start();
}
