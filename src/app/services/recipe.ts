import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { Platform } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class RecipeService {

  // private apiUrl: string = 'http://localhost:8080/api/recetas/generar';
  private apiUrl: string = 'https://asistente-cocina-api-production.up.railway.app/api/recetas/generar';

  constructor(private http: HttpClient) {
    // this.cargarIpGuardada();
  }

  async cargarIpGuardada() {
    const { value } = await Preferences.get({ key: 'server_ip' });
    if (value) {
      this.apiUrl = `http://${value}:8080/api/recetas/generar`;
    }
  }

  async guardarIp(ip: string) {
    this.apiUrl = `http://${ip}:8080/api/recetas/generar`;
    await Preferences.set({ key: 'server_ip', value: ip });
  }

  async printDataDommy(json: string): Promise<any[]> {

    const data = await firstValueFrom(
      this.http.get<any[]>(json)
    );

    return data;
  }

  // Servicio de testeo de conexión
  probarConexion(): Observable<any> {
    // Asumimos un endpoint health o simplemente intentamos hacer un GET a la base del API
    const baseUrl = this.apiUrl.replace('/generar', '/health');
    return this.http.get(baseUrl);
  }

  async cargarIp() {
    const { value } = await Preferences.get({ key: 'server_ip' });
    if (value) {
      return value;
    }
    return '';
  }

  generarReceta(base64Image: string, mensajeUsuario?: string): Observable<any> {
    const payload = {
      imageBase64: base64Image,
      mensaje: mensajeUsuario || ""
    };
    return this.http.post(this.apiUrl, payload);
  }
}