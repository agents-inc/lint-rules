// One file's `git diff -U0` output, as git 2.34 prints it, for the reader of the lines a change adds.

/** Two lines added after line 2, line 10 replaced (now line 12), and lines 20 to 22 deleted. */
export const ADDS_REPLACES_AND_DELETES = `diff --git a/src/a.ts b/src/a.ts
index 1234567..89abcde 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -2,0 +3,2 @@ export const a = 1
+debugger
+debugger
@@ -10 +12 @@ export function f() {
-  return 1
+  return 2
@@ -20,3 +21,0 @@ export function g() {
-x
-y
-z
`

/** A new file of three lines. */
export const A_NEW_FILE = `diff --git a/src/b.ts b/src/b.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/b.ts
@@ -0,0 +1,3 @@
+export const b = 1
+debugger
+debugger
`

/** Only deletions. */
export const ONLY_DELETES = `diff --git a/src/c.ts b/src/c.ts
index 1234567..89abcde 100644
--- a/src/c.ts
+++ b/src/c.ts
@@ -4,2 +3,0 @@ export const c = 1
-debugger
-debugger
`

/** A line changed whose hunk header's context, and whose own text, hold what looks like another hunk header. */
export const HEADER_LOOKALIKES = `diff --git a/src/d.ts b/src/d.ts
index 1234567..89abcde 100644
--- a/src/d.ts
+++ b/src/d.ts
@@ -1 +1 @@ const marker = '@@ -5 +9,3 @@'
-const header = '@@ -1 +1 @@'
+const header = '@@ -7 +40,2 @@'
`

/** The last line changed in a file that ends without a newline. */
export const NO_NEWLINE_AT_THE_END = `diff --git a/src/e.ts b/src/e.ts
index 1234567..89abcde 100644
--- a/src/e.ts
+++ b/src/e.ts
@@ -3 +3 @@ export const e = 1
-export const f = 1
\\ No newline at end of file
+export const f = 2
\\ No newline at end of file
`

/** Twelve lines from line 30 replaced by fifteen: both counts of two digits. */
export const A_HUNK_OF_MANY_LINES = `diff --git a/src/f.ts b/src/f.ts
index 1234567..89abcde 100644
--- a/src/f.ts
+++ b/src/f.ts
@@ -30,12 +30,15 @@ export function h() {
${Array.from({ length: 12 }, (_unused, index) => `-  const old${String(index)} = ${String(index)}`).join('\n')}
${Array.from({ length: 15 }, (_unused, index) => `+  const new${String(index)} = ${String(index)}`).join('\n')}
`
