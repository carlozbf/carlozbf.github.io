package main

import (
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"
)

func main() {
	port := ":8080"
	
	// Configurar el manejador para servir archivos estáticos del directorio actual
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)

	url := "http://localhost" + port
	fmt.Printf("⚡ Servidor de PartidoExpress iniciado en %s\n", url)
	fmt.Println("Para detener el servidor, presiona Ctrl+C.")

	// Intentar abrir el navegador automáticamente
	go openBrowser(url)

	// Iniciar el servidor
	err := http.ListenAndServe(port, nil)
	if err != nil {
		log.Fatalf("Error al iniciar el servidor: %v", err)
	}
}

// openBrowser abre la URL especificada en el navegador por defecto del sistema
func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("sistema operativo no soportado: %s", runtime.GOOS)
	}
	if err != nil {
		log.Printf("No se pudo abrir el navegador automáticamente: %v. Puedes abrirlo manualmente visitando %s", err, url)
	}
}
