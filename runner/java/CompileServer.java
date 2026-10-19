import javax.tools.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * A warm Java compiler for the SkillVerse code runner.
 *
 * Starting javac costs ~0.7 s of CPU every time, which is several seconds on a
 * small free server. This program starts once and keeps the compiler loaded.
 *
 * Protocol (one request per line on stdin):
 *   <absolute directory>            compile every .java file in it into <dir>/classes
 * Reply (one line on stdout):
 *   OK
 *   ERR <base64 of the compiler messages>
 *
 * It only COMPILES. Student code is never run inside this JVM; the runner starts
 * a separate, locked-down JVM for that (see executor.py).
 */
public class CompileServer {
    public static void main(String[] args) throws IOException {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8);
        String line;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            out.println(compile(compiler, Paths.get(line)));
        }
    }

    static String compile(JavaCompiler compiler, Path dir) {
        try {
            List<File> sources = new ArrayList<>();
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, "*.java")) {
                for (Path p : ds) sources.add(p.toFile());
            }
            Path classes = dir.resolve("classes");
            Files.createDirectories(classes);
            DiagnosticCollector<JavaFileObject> diags = new DiagnosticCollector<>();
            try (StandardJavaFileManager fm = compiler.getStandardFileManager(diags, Locale.ENGLISH, StandardCharsets.UTF_8)) {
                List<String> options = Arrays.asList("-d", classes.toString(), "-proc:none", "-nowarn", "-encoding", "UTF-8");
                boolean ok = compiler.getTask(null, fm, diags, options, null, fm.getJavaFileObjectsFromFiles(sources)).call();
                if (ok) return "OK";
            }
            StringBuilder sb = new StringBuilder();
            for (Diagnostic<? extends JavaFileObject> d : diags.getDiagnostics()) {
                if (d.getKind() != Diagnostic.Kind.ERROR) continue;
                String file = d.getSource() == null ? "" : new File(d.getSource().getName()).getName();
                sb.append(file).append(":").append(d.getLineNumber()).append(": error: ")
                  .append(d.getMessage(Locale.ENGLISH)).append("\n");
            }
            return "ERR " + Base64.getEncoder().encodeToString(sb.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Throwable t) {
            String msg = "Compiler problem: " + t;
            return "ERR " + Base64.getEncoder().encodeToString(msg.getBytes(StandardCharsets.UTF_8));
        }
    }
}
