import { Component, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { RecipeService } from '../services/recipe';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  vistaActual: string = 'cocinar';
  imagenCapturada: string | null = null;
  recetaGenerada: string | null = null;
  cargando: boolean = false;
  mensajeChat: string = '';

  // Lista de recetas originales
  recetasGuardadas: any[] = [];

  // Lista de recetas filtradas (la que se muestra en pantalla)
  recetasFiltradas: any[] = [];
  terminoBusqueda: string = '';

  // Control de receta seleccionada para ver a detalle en el modal
  recetaSeleccionada: any = null;
  isModalOpen: boolean = false;

  recetaAnterior: string | null = null;
  textoCargando: string = 'Inspirando al chef interior... 🌟';

  constructor(
    private recipeService: RecipeService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController
  ) { }

  ngOnInit() {
    this.cargarRecetasGuardadas();
  }



  // --- CONFIGURACIÓN DE SERVIDOR ---
  async abrirConfiguracion() {
    const alert = await this.alertCtrl.create({
      header: 'Configurar Servidor',
      message: 'Ingresa la dirección IP si deseas desarrollo local:',
      inputs: [{ name: 'ip', type: 'text', placeholder: 'Ej: 192.168.1.50' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Probar y Guardar',
          handler: (data) => {
            if (data.ip) {
              this.recipeService.guardarIp(data.ip);
              this.hacerTestConexion();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async hacerTestConexion() {
    this.recipeService.probarConexion().subscribe({
      next: () => this.mostrarToast('¡Conexión exitosa con el servidor!'),
      error: () => this.mostrarToast('Error: No se pudo conectar al servidor.')
    });
  }

  // --- LÓGICA DE RECETAS (GEMINI) ---
  async tomarFoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt
      });

      if (image && image.base64String) {
        this.imagenCapturada = `data:image/jpeg;base64,${image.base64String}`;
        this.recetaGenerada = null;
      }
    } catch (error) {
      console.error('Error al tomar foto: ', error);
    }
  }

  obtenerReceta() {
    if (!this.imagenCapturada) {
      this.mostrarToast('Por favor, toma una foto primero.');
      return;
    }

    this.cargando = true;

    // VALIDACIÓN: Si ya hay una receta en pantalla, es una MODIFICACIÓN
    if (this.recetaGenerada) {
      this.recetaAnterior = this.recetaGenerada; // Guardamos el respaldo seguro
      this.textoCargando = 'El chef está modificando tu receta... 🍳';
      this.recetaGenerada = null; // Ocultamos temporalmente para mostrar el loader limpio
    } else {
      // Es una generación nueva desde cero
      this.recetaAnterior = null;
      this.textoCargando = 'Inspirando al chef interior... 🌟';
    }

    const base64Limpio = this.imagenCapturada.split(',')[1];

    this.recipeService.generarReceta(base64Limpio, this.mensajeChat).subscribe({
      next: (res) => {
        this.recetaGenerada = res.receta;
        this.mensajeChat = ''; // Limpiamos el cuadro de texto
        this.cargando = false;
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;

        // ESTRATEGIA DE RETORNO: Si falla la modificación, recuperamos el respaldo
        if (this.recetaAnterior) {
          this.recetaGenerada = this.recetaAnterior;
        }

        // Lanzamos la alerta formal de error
        this.mostrarAlertaError();
      }
    });
  }

  async mostrarAlertaError() {
    const alert = await this.alertCtrl.create({
      header: 'No se pudo procesar',
      message: 'Hubo un problema al intentar modificar la receta con la IA en este momento. No te preocupes, hemos conservado tu receta anterior intacta.',
      buttons: ['Entendido']
    });
    await alert.present();
  }

  // --- PERSISTENCIA: GUARDAR RECETAS LOCALMENTE ---
  async cargarRecetasGuardadas() {
    const { value } = await Preferences.get({ key: 'recetas_guardadas' });
    // const value = await this.recipeService.printDataDommy('assets/recetas_guardadas.json');
    // console.log('Recetas cargadas desde JSON:', value);

    if (value) {
      this.recetasGuardadas = JSON.parse(value);
      this.recetasFiltradas = [...this.recetasGuardadas]; // Inicializamos la lista filtrada
    }
  }

  async guardarRecetaActual() {
    if (!this.recetaGenerada) return;

    const alert = await this.alertCtrl.create({
      header: 'Guardar Receta',
      inputs: [{ name: 'titulo', type: 'text', placeholder: 'Ej: Mi sopa de verduras' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (!data.titulo) {
              this.mostrarToast('Debes ingresar un título.');
              return;
            }

            const nuevaReceta = {
              id: Date.now().toString(),
              titulo: data.titulo,
              texto: this.recetaGenerada,
              imagen: this.imagenCapturada,
              fecha: new Date().toLocaleDateString()
            };

            this.recetasGuardadas.unshift(nuevaReceta);
            this.recetasFiltradas = [...this.recetasGuardadas]; // Actualizamos la lista filtrada
            this.terminoBusqueda = ''; // Limpiamos la búsqueda al guardar

            await Preferences.set({
              key: 'recetas_guardadas',
              value: JSON.stringify(this.recetasGuardadas)
            });

            this.mostrarToast('¡Receta guardada con éxito! 💾');
          }
        }
      ]
    });
    await alert.present();
  }

  // --- FUNCIÓN DE BÚSQUEDA ---
  buscarRecetas(event: any) {
    const texto = event.target.value;
    this.terminoBusqueda = texto;

    if (texto && texto.trim() !== '') {
      this.recetasFiltradas = this.recetasGuardadas.filter((receta) => {
        return (receta.titulo.toLowerCase().indexOf(texto.toLowerCase()) > -1);
      });
    } else {
      // Si el campo está vacío, mostramos todas
      this.recetasFiltradas = [...this.recetasGuardadas];
    }
  }

  // --- DETALLE Y MODAL ---
  verRecetaCompleta(receta: any) {
    this.recetaSeleccionada = receta;
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.recetaSeleccionada = null;
  }

  async eliminarReceta(recetaId: string, event: Event) {
    event.stopPropagation();

    const alert = await this.alertCtrl.create({
      header: '¿Eliminar Receta?',
      message: 'Esta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            this.recetasGuardadas = this.recetasGuardadas.filter(r => r.id !== recetaId);
            // Volvemos a aplicar el filtro actual
            this.buscarRecetas({ target: { value: this.terminoBusqueda } });

            await Preferences.set({
              key: 'recetas_guardadas',
              value: JSON.stringify(this.recetasGuardadas)
            });
            this.mostrarToast('Receta eliminada.');
          }
        }
      ]
    });
    await alert.present();
  }

  // --- AUXILIARES ---
  async mostrarToast(mensaje: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  // --- EXPORTAR COMO IMAGEN ---
  async exportarRecetaComoImagen() {
    const elemento = document.getElementById('receta-exportable');

    if (!elemento) {
      this.mostrarToast('No se encontró la receta para exportar.');
      return;
    }

    this.mostrarToast('Generando tarjeta, espera un momento... 📸');

    try {
      // 1. Tomamos la captura
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f7f9fc'
      });

      // 2. Convertimos a base64 y le quitamos la cabecera
      const imgData = canvas.toDataURL('image/png');
      const base64Data = imgData.split(',')[1];

      const nombreArchivo = this.recetaSeleccionada?.titulo ? this.recetaSeleccionada.titulo.replace(/\s+/g, '_') : 'Receta';

      // 3. Escribimos el archivo físicamente en la memoria caché del celular
      const savedFile = await Filesystem.writeFile({
        path: `${nombreArchivo}.png`,
        data: base64Data,
        directory: Directory.Cache
      });

      // 4. Abrimos el menú nativo de "Compartir" del celular
      await Share.share({
        title: '¡Mira esta receta!',
        text: `Te comparto esta receta de: ${this.recetaSeleccionada?.titulo}`,
        url: savedFile.uri,
        dialogTitle: 'Guardar o Compartir Receta'
      });

      this.mostrarToast('¡Menú abierto con éxito! 🖼️');

    } catch (error) {
      console.error('Error al exportar la imagen: ', error);
      this.mostrarToast('Hubo un error al crear la imagen.');
    }
  }

  // --- NUEVA LÓGICA MIGRADA: EXPORTAR CON DOS OPCIONES ---
  async abrirMenuExportar() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opciones de Exportación',
      buttons: [
        {
          text: 'Guardar en Descargas',
          icon: 'download-outline',
          handler: () => {
            this.procesarExportacion('descargar');
          }
        },
        {
          text: 'Compartir Receta (WhatsApp, Redes...)',
          icon: 'share-social-outline',
          handler: () => {
            this.procesarExportacion('compartir');
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel',
          icon: 'close-outline'
        }
      ]
    });
    await actionSheet.present();
  }

  async procesarExportacion(accion: 'descargar' | 'compartir') {
    const elemento = document.getElementById('receta-exportable');
    if (!elemento) {
      this.mostrarToast('No se encontró la receta para exportar.');
      return;
    }

    this.mostrarToast('Procesando tarjeta visual... 📸');

    try {
      // Tomamos la captura del contenedor HTML
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f7f9fc'
      });

      const imgData = canvas.toDataURL('image/png');
      const base64Data = imgData.split(',')[1];
      const nombreArchivo = this.recetaSeleccionada?.titulo ? this.recetaSeleccionada.titulo.replace(/\s+/g, '_') : 'Receta';

      if (accion === 'descargar') {
        // EJECUCIÓN OPCIÓN 1: GUARDAR EN DESCARGAS
        if (Capacitor.isNativePlatform()) {
          // Si es celular nativo, lo guardamos en la carpeta pública de documentos
          await Filesystem.writeFile({
            path: `${nombreArchivo}.png`,
            data: base64Data,
            directory: Directory.Documents
          });
          this.mostrarToast('¡Guardado en la carpeta Documentos de tu celular! 📁');
        } else {
          // Si estás probando en PC (Web Browser) forzamos la descarga nativa del navegador
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `${nombreArchivo}.png`;
          link.click();
          this.mostrarToast('¡Descargado en tu computadora! 💾');
        }
      } else {
        // EJECUCIÓN OPCIÓN 2: COMPARTIR MULTIMEDIA
        const savedFile = await Filesystem.writeFile({
          path: `${nombreArchivo}.png`,
          data: base64Data,
          directory: Directory.Cache // La caché se limpia sola, ideal para compartir
        });

        await Share.share({
          title: '¡Mira esta receta!',
          text: `Te comparto la tarjeta de la receta: ${this.recetaSeleccionada?.titulo}`,
          url: savedFile.uri,
          dialogTitle: 'Compartir Receta'
        });
      }

    } catch (error) {
      console.error('Error al exportar: ', error);
      this.mostrarToast('Hubo un error al procesar la imagen.');
    }
  }

  imagenCapturedOAntigua(): boolean {
    return this.imagenCapturada != null;
  }
  // --- NAVEGACIÓN Y CONFIGURACIÓN ---
  cambiarVista(nuevaVista: string) {
    this.vistaActual = nuevaVista;
    if (nuevaVista === 'guardadas') {
      // Recargamos el listado automáticamente al entrar a la sección para capturar recetas nuevas
      this.cargarRecetasGuardadas();
    }
  }

}
