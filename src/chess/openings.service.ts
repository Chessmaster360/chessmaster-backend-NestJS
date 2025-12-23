import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

interface OpeningsBook {
    [fen: string]: string;
}

@Injectable()
export class OpeningsService implements OnModuleInit {
    private openingsBook: OpeningsBook = {};

    onModuleInit() {
        this.loadOpeningsBook();
    }

    private loadOpeningsBook(): void {
        try {
            // Asegúrate de que la ruta sea correcta según tu estructura de carpetas
            const openingsPath = join(process.cwd(), 'src', 'resources', 'openings.json');
            const fileContent = readFileSync(openingsPath, 'utf-8');
            this.openingsBook = JSON.parse(fileContent);
            console.log(`✅ Loaded ${Object.keys(this.openingsBook).length} opening positions`);
        } catch (error) {
            console.error('❌ Failed to load openings book:', error.message);
            this.openingsBook = {};
        }
    }

    public getOpeningName(fen: string): string | null {
        // 1. Normalizar FEN (Tu JSON solo tiene la info de piezas, parte 0 del split)
        const fenPosition = fen.split(' ')[0];

        // 2. Buscar coincidencia exacta
        if (this.openingsBook[fenPosition]) {
            return this.openingsBook[fenPosition];
        }

        return null;
    }

    public isOpeningPhase(moveNumber: number): boolean {
        return moveNumber <= 10;
    }
}