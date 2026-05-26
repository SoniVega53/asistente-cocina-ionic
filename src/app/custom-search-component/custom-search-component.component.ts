import { Component, OnInit } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AlertController, ToastController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import { RecipeService } from '../services/recipe';

@Component({
  selector: 'app-custom-search-component',
  templateUrl: './custom-search-component.component.html',
  styleUrls: ['./custom-search-component.component.scss'],
  standalone: false
})
export class CustomSearchComponentComponent implements OnInit {

  cargando: boolean = false;
  textoCargando: string = 'Inspirando al chef interior... 🌟';
  imagenCapturada: string | null = null;


  // Lista dinámica de ingredientes que el usuario puede editar, borrar o añadir
  ingredientesManuales: string[] = [];
  nuevoIngredienteText: string = '';
  mensajeChat: string = '';
  recetaAnterior: string | null = null;

  // Filtros de personalización personalizados
  filtroPlato: string = '';
  filtroDificultad: string = '';
  filtroTiempo: string = '';
  dietasSeleccionadas: string[] = [];

  recetaGeneradaPersonalizada: string | null = null;

  constructor(
    private recipeService: RecipeService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() { }

  // === NUEVO: LECTOR DE FOTO PARA EXTRAER INGREDIENTES ===
  async escanearFotoIngredientes() {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt // Pregunta si desea usar Cámara o Galería
      });

      if (image && image.base64String) {
        this.imagenCapturada = `data:image/jpeg;base64,${image.base64String}`;
        this.cargando = true;
        this.textoCargando = 'El Chef IA está leyendo tu foto... 🔍';
        this.recetaGeneradaPersonalizada = null;

        // Llamamos al endpoint de detección del servidor
        this.recipeService.detectarIngredientes(image.base64String).subscribe({
          next: (respuesta: any) => {
            this.cargando = false;
            if (respuesta.ingredientes && respuesta.ingredientes.length > 0) {
              // Insertamos los ingredientes escaneados en la lista interactiva
              this.ingredientesManuales = [...this.ingredientesManuales, ...respuesta.ingredientes];
              this.mostrarToast(`¡Se detectaron ${respuesta.ingredientes.length} ingredientes con éxito! 🥑`);
            } else {
              this.mostrarToast('No se encontraron ingredientes claros. Intenta añadir manualmente.');
            }
          },
          error: (error: any) => {
            console.error(error);
            this.cargando = false;
            this.mostrarToast('Error al conectar con el lector de imágenes del servidor.');
          }
        });
      }
    } catch (err) {
      console.log('Escaneo cancelado por el usuario.');
    }
  }

  // === GESTIÓN DE LA LISTA INTERACTIVA ===
  agregarIngredienteManual() {
    if (this.nuevoIngredienteText.trim() === '') return;
    this.ingredientesManuales.push(this.nuevoIngredienteText.trim());
    this.nuevoIngredienteText = '';
  }

  eliminarIngredienteManual(index: number) {
    this.ingredientesManuales.splice(index, 1);
  }

  async editarIngredienteManual(index: number) {
    const alert = await this.alertCtrl.create({
      header: 'Editar Ingrediente',
      inputs: [
        {
          name: 'nombreEditado',
          type: 'text',
          value: this.ingredientesManuales[index],
          placeholder: 'Nombre del ingrediente'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            if (data.nombreEditado && data.nombreEditado.trim() !== '') {
              this.ingredientesManuales[index] = data.nombreEditado.trim();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  toggleDieta(dieta: string) {
    const idx = this.dietasSeleccionadas.indexOf(dieta);
    if (idx > -1) {
      this.dietasSeleccionadas.splice(idx, 1);
    } else {
      this.dietasSeleccionadas.push(dieta);
    }
  }

  // === GENERACIÓN FINAL UTILIZANDO LA LISTA DE INGREDIENTES PURIFICADA ===
  generarRecetaPersonalizada() {
    if (this.ingredientesManuales.length === 0) {
      this.mostrarToast('Por favor, ingresa ingredientes o toma una foto primero.');
      return;
    }

    this.cargando = true;
    this.textoCargando = 'El chef está personalizando tu menú... 🍳';
    this.recetaGeneradaPersonalizada = null;

    // Redactamos las instrucciones adicionales basadas en los filtros
    let instruccionesExtra = '';
    if (this.filtroPlato) instruccionesExtra += `Tipo de plato deseado: ${this.filtroPlato}. `;
    if (this.filtroDificultad) instruccionesExtra += `Nivel de dificultad: ${this.filtroDificultad}. `;
    if (this.filtroTiempo) instruccionesExtra += `Tiempo máximo de preparación: ${this.filtroTiempo}. `;
    if (this.dietasSeleccionadas.length > 0) {
      instruccionesExtra += `Ajustar estrictamente a estas dietas: ${this.dietasSeleccionadas.join(', ')}.`;
    }

    // Llamamos al endpoint refinado que procesa arrays de texto sin enviar imágenes pesadas
    this.recipeService.generarRecetaConLista(this.ingredientesManuales, instruccionesExtra).subscribe({
      next: (respuesta: any) => {
        this.recetaGeneradaPersonalizada = respuesta.receta;
        this.cargando = false;
      },
      error: (error: any) => {
        console.error(error);
        this.cargando = false;
        this.mostrarToast('No se pudo procesar la receta final con la IA.');
      }
    });
  }

  // === GUARDADO DIRECTO COMPATIBLE CON TU SISTEMA ORIGINAL ===
  async guardarRecetaPersonalizada() {
    if (!this.recetaGeneradaPersonalizada) return;

    const alert = await this.alertCtrl.create({
      header: 'Guardar Receta',
      inputs: [{ name: 'titulo', type: 'text', placeholder: 'Ej: Mi ensalada personalizada' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (!data.titulo) {
              this.mostrarToast('Debes ingresar un título.');
              return;
            }

            // Recuperamos el listado de recetas guardadas actual en el disco
            const { value } = await Preferences.get({ key: 'recetas_guardadas' });
            let recetasActivas: any[] = value ? JSON.parse(value) : [];

            const nuevaReceta = {
              id: Date.now().toString(),
              titulo: data.titulo,
              fecha: new Date().toLocaleDateString(),
              imagen: this.imagenCapturada, 
              texto: this.recetaGeneradaPersonalizada
            };

            recetasActivas.unshift(nuevaReceta);

            // Almacenamos en el mismo llavero local para que sincronice con la pestaña Guardadas
            await Preferences.set({
              key: 'recetas_guardadas',
              value: JSON.stringify(recetasActivas)
            });

            this.mostrarToast('¡Receta guardada con éxito! 💾');
          }
        }
      ]
    });
    await alert.present();
  }

  enviarModificacionPersonalizada() {
    if (this.mensajeChat.trim() === '' || !this.recetaGeneradaPersonalizada) return;

    this.cargando = true;
    this.textoCargando = 'El chef está modificando tu receta... 🍳';
    this.recetaAnterior = this.recetaGeneradaPersonalizada;
    this.recetaGeneradaPersonalizada = null;

    // Enganchamos la instrucción del chat junto con los ingredientes actuales de los chips
    let promptModificador = `Tomando como base la lista de ingredientes: [${this.ingredientesManuales.join(', ')}]. `;
    promptModificador += `Por favor modifica la receta anterior aplicando esta instrucción: ${this.mensajeChat}`;

    // Enviamos al servicio utilizando el endpoint de lista de texto
    this.recipeService.generarRecetaConLista(this.ingredientesManuales, promptModificador).subscribe({
      next: (respuesta: any) => {
        this.recetaGeneradaPersonalizada = respuesta.receta;
        this.cargando = false;
        this.mensajeChat = ''; // Limpiamos el cuadro de entrada
      },
      error: (error: any) => {
        console.error(error);
        this.cargando = false;
        if (this.recetaAnterior) {
          this.recetaGeneradaPersonalizada = this.recetaAnterior; // Retorno de respaldo
        }
        this.mostrarAlertaError();
      }
    });
  }

  async mostrarAlertaError() {
    const alert = await this.alertCtrl.create({
      header: 'No se pudo procesar',
      message: 'Hubo un problema al intentar procesar la modificación con la IA. Conservamos tu receta anterior intacta.',
      buttons: ['Entendido']
    });
    await alert.present();
  }

  async mostrarToast(mensaje: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom'
    });
    await toast.present();
  }
}