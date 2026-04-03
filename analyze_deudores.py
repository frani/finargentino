import os

def analyze_deudores(deudores_path, maeent_path):
    # Diccionario para nombres de entidades
    entities = {}
    if os.path.exists(maeent_path):
        with open(maeent_path, 'r', encoding='latin-1') as f:
            for line in f:
                if len(line) >= 5:
                    e_id = line[:5]
                    e_name = line[5:].strip()
                    entities[e_id] = e_name

    # Estadísticas por entidad
    stats = {} # id -> {'name': str, 'count': int, 'monto': float}
    date_str = None

    print(f"Procesando archivo de deudores: {deudores_path}...")
    
    with open(deudores_path, 'r') as f:
        for line in f:
            if len(line) < 41:
                continue
            
            # Extraer fecha del primer registro válido
            if date_str is None:
                date_str = line[5:11] # AAAAMM
            
            # Campo 1: Código entidad (5 dígitos) - line[0:5]
            e_id = line[:5]
            
            # Campo 6: Situación (2 dígitos) - line[27:29]
            situacion = line[27:29].strip()
            if not situacion:
                situacion = "DESC"

            # Campo 7: Préstamos / Total garantías (12 chars, 1 decimal) - line[29:41]
            monto_str = line[29:41].replace(',', '.').strip()
            
            try:
                monto_val = float(monto_str)
            except ValueError:
                monto_val = 0.0
                
            if e_id not in stats:
                stats[e_id] = {
                    'name': entities.get(e_id, f"Entidad {e_id}"),
                    'count': 0,
                    'monto': 0.0,
                    'situaciones': {}
                }
                
            stats[e_id]['count'] += 1
            stats[e_id]['monto'] += monto_val
            
            if situacion not in stats[e_id]['situaciones']:
                stats[e_id]['situaciones'][situacion] = 0.0
            stats[e_id]['situaciones'][situacion] += monto_val

    # Determinar nombre del CSV
    if date_str and len(date_str) == 6:
        year = int(date_str[:4])
        month = int(date_str[4:6])
        
        # Restar 1 mes para que coincida con el cierre de balances (ej. 202601 -> 202512)
        month -= 1
        if month == 0:
            month = 12
            year -= 1
            
        csv_filename = f"{year:04d}-{month:02d}-DEUDORES.csv"
    else:
        csv_filename = "DEUDORES.csv"

    # Determinar todas las situaciones únicas reportadas
    todas_situaciones = set()
    for s in stats.values():
        todas_situaciones.update(s['situaciones'].keys())
    
    # Ordenar las situaciones numéricamente (poniendo "DESC" u otros al final)
    situaciones_ordenadas = sorted(list(todas_situaciones), key=lambda x: int(x) if x.isdigit() else 999)

    # Guardar en CSV
    import csv
    with open(csv_filename, mode='w', newline='', encoding='utf-8') as csv_file:
        fieldnames = ['ID_ENTIDAD', 'NOMBRE_ENTIDAD', 'CANTIDAD_DEUDORES', 'MONTO_TOTAL'] 
        fieldnames += [f'MONTO_SIT_{sit}' for sit in situaciones_ordenadas]
        
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        
        for e_id in sorted(stats.keys()):
            s = stats[e_id]
            row = {
                'ID_ENTIDAD': e_id,
                'NOMBRE_ENTIDAD': s['name'],
                'CANTIDAD_DEUDORES': s['count'],
                'MONTO_TOTAL': s['monto']
            }
            # Cargar montos por situación para la entidad
            for sit in situaciones_ordenadas:
                row[f'MONTO_SIT_{sit}'] = s['situaciones'].get(sit, 0.0)
                
            writer.writerow(row)

    print(f"\nResultados guardados exitosamente en: {csv_filename}")

    # Imprimir resumen corto por consola
    print("\nResumen (Top 10 por monto):")
    print(f"{'ID':<6} | {'ENTIDAD':<50} | {'DEUDORES':<10} | {'MONTO TOTAL':<15}")
    print("-" * 90)

    # Ordenar por monto descendente para el resumen visual
    top_stats = sorted(stats.items(), key=lambda x: x[1]['monto'], reverse=True)[:10]
    for e_id, s in top_stats:
        print(f"{e_id:<6} | {s['name'][:50]:<50} | {s['count']:>10} | {s['monto']:>20,.1f}")

if __name__ == "__main__":
    DEUDORES_FILE = './.bcra/202601DEUDORES/deudores.txt'
    MAEENT_FILE = './.bcra/202601DEUDORES/Maeent.txt'
    
    analyze_deudores(DEUDORES_FILE, MAEENT_FILE)
