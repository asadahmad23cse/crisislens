<?php
// Database connection with error handling (mysqli_connect)
try {
    $conn = mysqli_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    mysqli_set_charset($conn, 'utf8mb4');
} catch (mysqli_sql_exception $ex) {
    http_response_code(500);
    echo '<div style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:24px;border:1px solid #f5c2c7;background:#f8d7da;border-radius:10px">';
    echo '<h2>Database connection failed</h2>';
    echo '<p>' . htmlspecialchars($ex->getMessage()) . '</p>';
    echo '<p>Start MySQL in XAMPP and run <a href="install.php">install.php</a> once to create the database.</p>';
    echo '</div>';
    exit;
}

/** Run a prepared statement and return the statement object. */
function db_query(mysqli $conn, string $sql, string $types = '', array $params = []): mysqli_stmt
{
    $stmt = mysqli_prepare($conn, $sql);
    if ($types !== '') {
        mysqli_stmt_bind_param($stmt, $types, ...$params);
    }
    mysqli_stmt_execute($stmt);
    return $stmt;
}

/** Fetch a single row as an associative array (or null). */
function db_one(mysqli $conn, string $sql, string $types = '', array $params = []): ?array
{
    $result = mysqli_stmt_get_result(db_query($conn, $sql, $types, $params));
    $row = mysqli_fetch_assoc($result);
    return $row ?: null;
}

/** Fetch all rows as an array of associative arrays. */
function db_all(mysqli $conn, string $sql, string $types = '', array $params = []): array
{
    $result = mysqli_stmt_get_result(db_query($conn, $sql, $types, $params));
    $rows = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $rows[] = $row;
    }
    return $rows;
}
