@ECHO OFF

SET APP_HOME=%~dp0
SET CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar

IF EXIST "%JAVA_HOME%\bin\java.exe" (
  SET JAVACMD="%JAVA_HOME%\bin\java.exe"
) ELSE (
  SET JAVACMD=java
)

IF NOT EXIST "%JAVACMD%" (
  ECHO ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH. 1>&2
  EXIT /B 1
)

%JAVACMD% -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

